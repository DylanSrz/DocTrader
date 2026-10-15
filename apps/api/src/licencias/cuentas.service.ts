import {
  claveDeCuenta,
  ESTADO_CONEXION,
  ESTADO_LICENCIA,
  ESTADO_ORDEN,
  LIMITES_CUENTA,
  limpiarTexto,
  normalizarParaComparar,
} from '@doctrader/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type EntityManager, In, IsNull, QueryFailedError } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService } from '../avisos/avisos.service.js';
import { fechaLegible } from '../avisos/fecha.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import {
  License,
  LicensePeriod,
  PaymentOrder,
  Plan,
  TradingAccount,
  User,
} from '../database/entidades/index.js';
import { CifradoService } from '../seguridad/cifrado.service.js';
import { errorApi, errorDeCampos } from '../seguridad/errores.js';
import { LIMITES, LimitesService } from '../seguridad/limites.service.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { leerAjustes } from './ajustes.js';
import type { CuentaDto, EditarCuentaDto } from './dto.js';
import { estadoVisible, vistaCuenta, vistaPlan } from './vista.js';

/** Contextos del cifrado (van como dato asociado: un valor cifrado no sirve en otra columna). */
export const CONTEXTO_CONTRASENA_OPERATIVA = 'trading_accounts.master_password';
export const CONTEXTO_CONTRASENA_INVERSOR = 'trading_accounts.investor_password';

const NOMBRES_CAMPOS: Record<string, string> = {
  titular: 'titular',
  broker: 'broker',
  servidor: 'servidor',
  numero: 'número de cuenta',
  contrasenaOperativa: 'contraseña operativa',
  contrasenaInversor: 'contraseña de inversor',
};

/** Dos clientes agregando la misma cuenta al mismo tiempo: el índice único de la base de datos decide. */
function cuentaRepetida(error: unknown): never {
  if (
    error instanceof QueryFailedError &&
    (error.driverError as { constraint?: string }).constraint === 'trading_accounts_cuenta_vigente'
  ) {
    throw errorDeCampos({
      numero:
        'Esta cuenta de trading ya está registrada en la plataforma. Si es tuya, escríbenos a soporte.',
    });
  }
  throw error;
}

function noEncontrada() {
  return errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'No encontramos esa cuenta de trading.');
}

/**
 * Cuentas de trading del cliente: agregarlas (con su licencia por pagar), editarlas y quitarlas. Cada consulta
 * se filtra por el dueño, así que un id ajeno responde igual que uno que no existe.
 */
@Injectable()
export class CuentasService {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly cifrado: CifradoService,
    private readonly limites: LimitesService,
    private readonly auditoria: AuditoriaService,
    private readonly avisos: AvisosService,
  ) {}

  /** Todo lo que muestra "Mis cuentas": cuentas, licencias, periodos, órdenes abiertas y planes a la venta. */
  async listar(usuarioId: string) {
    const m = this.fuente.manager;
    const [cuentas, planes, ajustes] = await Promise.all([
      m.getRepository(TradingAccount).find({
        where: { userId: usuarioId, deletedAt: IsNull() },
        order: { createdAt: 'ASC' },
      }),
      m.getRepository(Plan).find({ order: { rank: 'ASC' } }),
      leerAjustes(m),
    ]);
    const idsCuentas = cuentas.map((c) => c.id);
    const licencias = idsCuentas.length
      ? await m.getRepository(License).findBy({ tradingAccountId: In(idsCuentas) })
      : [];
    const idsLicencias = licencias.map((l) => l.id);
    const [periodos, abiertas] = idsLicencias.length
      ? await Promise.all([
          m.getRepository(LicensePeriod).find({
            where: { licenseId: In(idsLicencias) },
            order: { periodStart: 'ASC' },
          }),
          m.getRepository(PaymentOrder).findBy({
            licenseId: In(idsLicencias),
            status: In([ESTADO_ORDEN.PENDIENTE, ESTADO_ORDEN.REPORTADA]),
          }),
        ])
      : [[], []];
    const planesPorId = new Map(planes.map((p) => [p.id, p]));
    return {
      cuentas: cuentas.map((cuenta) => {
        const licencia = licencias.find((l) => l.tradingAccountId === cuenta.id)!;
        return vistaCuenta(
          cuenta,
          licencia,
          periodos.filter((p) => p.licenseId === licencia.id),
          planesPorId,
          // Una pendiente cuya hora pasó ya no cuenta como abierta, aunque el worker aún no la haya marcado.
          abiertas.find((o) => o.licenseId === licencia.id && estadoVisible(o) !== 'EXPIRADA') ??
            null,
        );
      }),
      planes: planes.filter((p) => p.isActive && p.isPublic).map(vistaPlan),
      diasGracia: ajustes.diasGracia,
    };
  }

  async agregar(dto: CuentaDto, sesion: SesionActiva, cliente: ContextoCliente) {
    await this.limites.exigir(LIMITES.cuentasPorUsuario, sesion.usuarioId);
    const datos = this.limpiar(dto);
    const clave = this.huellaCuenta(datos.broker, datos.servidor, datos.numero);

    const id = await this.fuente
      .transaction(async (m) => {
        // Un candado por cliente: dos pestañas no pueden pasar a la vez el límite de cuentas.
        await m.query(`SELECT pg_advisory_xact_lock(7321003, hashtext($1))`, [sesion.usuarioId]);
        const cantidad = await m
          .getRepository(TradingAccount)
          .countBy({ userId: sesion.usuarioId, deletedAt: IsNull() });
        if (cantidad >= LIMITES_CUENTA.maximoPorCliente) {
          throw errorApi(
            HttpStatus.CONFLICT,
            'MAXIMO_DE_CUENTAS',
            `Puedes tener hasta ${LIMITES_CUENTA.maximoPorCliente} cuentas. Escríbenos si necesitas más.`,
          );
        }
        await this.exigirCuentaLibre(m, clave, sesion.usuarioId, null);

        const cuenta = await m.getRepository(TradingAccount).save(
          m.getRepository(TradingAccount).create({
            userId: sesion.usuarioId,
            holderName: datos.titular,
            broker: datos.broker,
            server: datos.servidor,
            accountNumber: datos.numero,
            accountKeyHmac: clave,
            accountNumberHmac: this.huellaNumero(datos.numero),
            masterPasswordEnc: this.cifrado.cifrar(
              dto.contrasenaOperativa,
              CONTEXTO_CONTRASENA_OPERATIVA,
            ),
            investorPasswordEnc: this.cifrado.cifrar(
              dto.contrasenaInversor,
              CONTEXTO_CONTRASENA_INVERSOR,
            ),
            connectionStatus: ESTADO_CONEXION.SIN_LICENCIA,
          }),
        );
        await m.getRepository(License).insert({
          tradingAccountId: cuenta.id,
          userId: sesion.usuarioId,
          status: ESTADO_LICENCIA.PENDIENTE_PAGO,
        });
        await this.auditoria.registrar(
          {
            actorId: sesion.usuarioId,
            actorRole: sesion.rol,
            action: 'cuenta.agregada',
            targetType: 'trading_account',
            targetId: cuenta.id,
            metadata: { broker: datos.broker, servidor: datos.servidor },
            ip: cliente.ip,
            userAgent: cliente.userAgent ?? null,
          },
          m,
        );
        return cuenta.id;
      })
      .catch(cuentaRepetida);
    return this.una(sesion.usuarioId, id);
  }

  async editar(id: string, dto: EditarCuentaDto, sesion: SesionActiva, cliente: ContextoCliente) {
    await this.limites.exigir(LIMITES.cuentasPorUsuario, sesion.usuarioId);
    const datos = this.limpiar(dto);

    await this.fuente
      .transaction(async (m) => {
        const cuenta = await this.propia(m, sesion.usuarioId, id, true);
        const cambios: string[] = [];
        if (datos.titular !== cuenta.holderName) cambios.push('titular');
        if (normalizarParaComparar(datos.broker) !== normalizarParaComparar(cuenta.broker)) {
          cambios.push('broker');
        }
        if (normalizarParaComparar(datos.servidor) !== normalizarParaComparar(cuenta.server)) {
          cambios.push('servidor');
        }
        if (datos.numero !== cuenta.accountNumber) cambios.push('numero');
        if (dto.contrasenaOperativa) cambios.push('contrasenaOperativa');
        if (dto.contrasenaInversor) cambios.push('contrasenaInversor');
        // Mayúsculas o espacios en el broker y el servidor no cuentan como cambio, pero se guardan como los escribió.
        const soloForma =
          cambios.length === 0 &&
          (datos.broker !== cuenta.broker || datos.servidor !== cuenta.server);
        if (cambios.length === 0 && !soloForma) return;

        const cambiaIdentidad = cambios.some((c) => ['broker', 'servidor', 'numero'].includes(c));
        if (cambiaIdentidad && cuenta.lockedUntil && cuenta.lockedUntil > new Date()) {
          throw errorApi(
            HttpStatus.CONFLICT,
            'CUENTA_BLOQUEADA',
            'Durante la prueba no se pueden cambiar el broker, el servidor ni el número de la cuenta.',
          );
        }
        const clave = this.huellaCuenta(datos.broker, datos.servidor, datos.numero);
        if (cambiaIdentidad) await this.exigirCuentaLibre(m, clave, sesion.usuarioId, cuenta.id);

        // Si ya estaba conectada, el admin tiene que actualizarla en Social Trader Tools (MODELO-DATOS §6, regla 4).
        const reconectar =
          cambios.some((c) => c !== 'titular') &&
          cuenta.connectionStatus === ESTADO_CONEXION.CONECTADA;

        await m.getRepository(TradingAccount).update(
          { id: cuenta.id },
          {
            holderName: datos.titular,
            broker: datos.broker,
            server: datos.servidor,
            accountNumber: datos.numero,
            accountKeyHmac: clave,
            accountNumberHmac: this.huellaNumero(datos.numero),
            ...(dto.contrasenaOperativa
              ? {
                  masterPasswordEnc: this.cifrado.cifrar(
                    dto.contrasenaOperativa,
                    CONTEXTO_CONTRASENA_OPERATIVA,
                  ),
                  passwordsPurgedAt: null,
                }
              : {}),
            ...(dto.contrasenaInversor
              ? {
                  investorPasswordEnc: this.cifrado.cifrar(
                    dto.contrasenaInversor,
                    CONTEXTO_CONTRASENA_INVERSOR,
                  ),
                  passwordsPurgedAt: null,
                }
              : {}),
            ...(reconectar ? { connectionStatus: ESTADO_CONEXION.POR_CONECTAR } : {}),
          },
        );
        if (cambios.length === 0) return;

        const usuario = await m.getRepository(User).findOneByOrFail({ id: sesion.usuarioId });
        await this.avisos.encolar(m, {
          usuarioId: usuario.id,
          correo: usuario.email,
          plantilla: PLANTILLA.CUENTA_TRADING_CAMBIADA,
          datos: {
            nombre: usuario.fullName.split(' ')[0] ?? usuario.fullName,
            numero: datos.numero,
            fecha: fechaLegible(),
            campos: cambios.map((c) => NOMBRES_CAMPOS[c]).join(', '),
            reconectar: reconectar ? 'si' : 'no',
          },
        });
        await this.auditoria.registrar(
          {
            actorId: sesion.usuarioId,
            actorRole: sesion.rol,
            action: 'cuenta.editada',
            targetType: 'trading_account',
            targetId: cuenta.id,
            metadata: { campos: cambios, reconectar },
            ip: cliente.ip,
            userAgent: cliente.userAgent ?? null,
          },
          m,
        );
      })
      .catch(cuentaRepetida);
    return this.una(sesion.usuarioId, id);
  }

  /**
   * Quitar una cuenta solo se puede si no tiene una licencia en curso ni un pago reportado, y si no está
   * conectada: así nadie se salta la lista "por desconectar". Las contraseñas se borran de inmediato.
   */
  async quitar(id: string, sesion: SesionActiva, cliente: ContextoCliente): Promise<void> {
    await this.fuente.transaction(async (m) => {
      const cuenta = await this.propia(m, sesion.usuarioId, id, true);
      const licencia = await m
        .getRepository(License)
        .createQueryBuilder('l')
        .setLock('pessimistic_write')
        .where('l.trading_account_id = :id', { id: cuenta.id })
        .getOneOrFail();
      const reportada = await m
        .getRepository(PaymentOrder)
        .existsBy({ licenseId: licencia.id, status: ESTADO_ORDEN.REPORTADA });
      const licenciaLibre =
        licencia.status === ESTADO_LICENCIA.PENDIENTE_PAGO ||
        licencia.status === ESTADO_LICENCIA.VENCIDA;
      const sinConexion =
        cuenta.connectionStatus === ESTADO_CONEXION.SIN_LICENCIA ||
        cuenta.connectionStatus === ESTADO_CONEXION.DESCONECTADA;
      if (!licenciaLibre || !sinConexion || reportada) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'CUENTA_EN_USO',
          reportada
            ? 'Esta cuenta tiene un pago en revisión. Espera a que lo revisemos para quitarla.'
            : 'Esta cuenta tiene una licencia en curso o sigue conectada. Escríbenos a soporte si quieres quitarla.',
        );
      }
      await m
        .getRepository(PaymentOrder)
        .update(
          { licenseId: licencia.id, status: ESTADO_ORDEN.PENDIENTE },
          { status: ESTADO_ORDEN.CANCELADA },
        );
      await m.getRepository(TradingAccount).update(
        { id: cuenta.id },
        {
          deletedAt: new Date(),
          masterPasswordEnc: null,
          investorPasswordEnc: null,
          passwordsPurgedAt: new Date(),
        },
      );
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'cuenta.quitada',
          targetType: 'trading_account',
          targetId: cuenta.id,
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
  }

  /** Una cuenta del cliente, como la muestra la lista. */
  async una(usuarioId: string, id: string) {
    const { cuentas } = await this.listar(usuarioId);
    const cuenta = cuentas.find((c) => c.id === id);
    if (!cuenta) throw noEncontrada();
    return cuenta;
  }

  /** La cuenta, si es del cliente y no está borrada. Con `bloquear`, queda bloqueada hasta el fin de la transacción. */
  async propia(m: EntityManager, usuarioId: string, id: string, bloquear = false) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw noEncontrada();
    const consulta = m
      .getRepository(TradingAccount)
      .createQueryBuilder('c')
      .where('c.id = :id AND c.user_id = :usuarioId AND c.deleted_at IS NULL', { id, usuarioId });
    if (bloquear) consulta.setLock('pessimistic_write');
    const cuenta = await consulta.getOne();
    if (!cuenta) throw noEncontrada();
    return cuenta;
  }

  private limpiar(dto: EditarCuentaDto) {
    return {
      titular: limpiarTexto(dto.titular),
      broker: limpiarTexto(dto.broker),
      servidor: limpiarTexto(dto.servidor),
      numero: dto.numero.trim(),
    };
  }

  private huellaCuenta(broker: string, servidor: string, numero: string): Buffer {
    return this.cifrado.huella('cuenta-trading', claveDeCuenta(broker, servidor, numero));
  }

  private huellaNumero(numero: string): Buffer {
    return this.cifrado.huella('numero-cuenta', normalizarParaComparar(numero));
  }

  /** Una cuenta de trading solo puede estar en un cliente. No se dice en cuál. */
  private async exigirCuentaLibre(
    m: EntityManager,
    clave: Buffer,
    usuarioId: string,
    excepto: string | null,
  ) {
    const existente = await m
      .getRepository(TradingAccount)
      .createQueryBuilder('c')
      .select(['c.id', 'c.userId'])
      .where('c.account_key_hmac = :clave AND c.deleted_at IS NULL', { clave })
      .getOne();
    if (!existente || existente.id === excepto) return;
    throw errorDeCampos({
      numero:
        existente.userId === usuarioId
          ? 'Ya agregaste esta cuenta de trading.'
          : 'Esta cuenta de trading ya está registrada en la plataforma. Si es tuya, escríbenos a soporte.',
    });
  }
}
