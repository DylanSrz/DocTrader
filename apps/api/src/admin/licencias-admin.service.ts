import {
  DIAS_VENCE_PRONTO,
  diasEntre,
  ESTADO_LICENCIA,
  ESTADO_USUARIO,
  type EstadoConexion,
  type EstadoLicencia,
  type EstadoOrden,
  type FiltroLicencias,
  FILTROS_LICENCIAS,
  type Moneda,
  type NivelRiesgo,
  sumarDias,
  TIPO_PERIODO,
  type TipoOrden,
  type TipoPeriodo,
} from '@doctrader/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { CONTEXTO as CONTEXTO_ACCESO } from '../acceso/acceso.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService } from '../avisos/avisos.service.js';
import { fechaSinHora } from '../avisos/fecha.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import { License, LicensePeriod, TradingAccount, User } from '../database/entidades/index.js';
import { leerAjustes } from '../licencias/ajustes.js';
import { conexionAlActivar, conexionAlDesactivar } from '../licencias/conexion.js';
import { CifradoService } from '../seguridad/cifrado.service.js';
import { errorApi } from '../seguridad/errores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { aCsv } from './csv.js';

/** Condición SQL de cada filtro de la lista (sobre `licenses l`). */
const CONDICION: Record<FiltroLicencias, string> = {
  todas: 'true',
  activas: `l.status = 'ACTIVA'`,
  vence: `l.status = 'ACTIVA' AND l.ends_at <= now() + interval '${DIAS_VENCE_PRONTO} days'`,
  gracia: `l.status = 'EN_GRACIA'`,
  vencidas: `l.status = 'VENCIDA'`,
  pendientes: `l.status = 'PENDIENTE_PAGO'`,
  suspendidas: `l.status = 'SUSPENDIDA'`,
};

const MAXIMO_FILAS = 500;

interface FilaLicencia {
  id: string;
  status: EstadoLicencia;
  starts_at: Date | null;
  ends_at: Date | null;
  grace_ends_at: Date | null;
  plan: string | null;
  cuenta_id: string;
  numero: string;
  broker: string;
  servidor: string;
  conexion: EstadoConexion;
  capital: number | null;
  riesgo: NivelRiesgo | null;
  cliente_id: string;
  cliente: string;
  correo: string;
  telefono: string | null;
}

const CONSULTA_LISTA = `
  SELECT l.id, l.status, l.starts_at, l.ends_at, l.grace_ends_at, p.name AS plan,
         t.id AS cuenta_id, t.account_number AS numero, t.broker, t.server AS servidor,
         t.connection_status AS conexion, t.recommended_capital_usd_cents AS capital, t.risk_level AS riesgo,
         u.id AS cliente_id, u.full_name AS cliente, u.email AS correo, u.phone_e164 AS telefono
    FROM licenses l
    JOIN trading_accounts t ON t.id = l.trading_account_id AND t.deleted_at IS NULL
    JOIN users u ON u.id = l.user_id
    LEFT JOIN plans p ON p.id = l.plan_id`;

/** Busca por nombre, correo o número de cuenta. Escapa los comodines de LIKE. */
function condicionBusqueda(q: string, parametros: unknown[]): string {
  const limpio = q.trim().slice(0, 80);
  if (!limpio) return 'true';
  parametros.push(`%${limpio.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const n = parametros.length;
  return `(u.full_name ILIKE $${n} OR u.email ILIKE $${n} OR t.account_number ILIKE $${n})`;
}

function texto(dias: number) {
  return dias === 1 ? '1 día' : `${dias} días`;
}

/** Licencias, ficha del cliente y los ajustes manuales: extender días, suspender y reactivar. */
@Injectable()
export class LicenciasAdminService {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly cifrado: CifradoService,
    private readonly auditoria: AuditoriaService,
    private readonly avisos: AvisosService,
  ) {}

  async listar(filtro: FiltroLicencias, q: string) {
    const m = this.fuente.manager;
    const parametros: unknown[] = [];
    const busqueda = condicionBusqueda(q, parametros);
    const conteos = FILTROS_LICENCIAS.map(
      (f) => `count(*) FILTER (WHERE ${CONDICION[f]})::int AS "${f}"`,
    ).join(', ');
    const [filas, [cuentas]] = await Promise.all([
      m.query(
        `${CONSULTA_LISTA} WHERE ${CONDICION[filtro]} AND ${busqueda}
          ORDER BY l.ends_at ASC NULLS LAST, l.created_at DESC LIMIT ${MAXIMO_FILAS + 1}`,
        parametros,
      ) as Promise<FilaLicencia[]>,
      m.query(
        `SELECT ${conteos} FROM licenses l
           JOIN trading_accounts t ON t.id = l.trading_account_id AND t.deleted_at IS NULL
           JOIN users u ON u.id = l.user_id
          WHERE ${busqueda}`,
        parametros,
      ) as Promise<Record<FiltroLicencias, number>[]>,
    ]);
    const ahora = new Date();
    return {
      filtro,
      busqueda: q.trim().slice(0, 80),
      conteos: cuentas!,
      recortada: filas.length > MAXIMO_FILAS,
      licencias: filas.slice(0, MAXIMO_FILAS).map((f) => ({
        id: f.id,
        estado: f.status,
        plan: f.plan,
        inicio: f.starts_at,
        vence: f.ends_at,
        finGracia: f.grace_ends_at,
        // Negativo cuando ya venció: el admin ve cuántos días lleva vencida.
        dias: f.ends_at ? diasEntre(ahora, f.ends_at) : null,
        cuenta: { id: f.cuenta_id, numero: f.numero, broker: f.broker, conexion: f.conexion },
        cliente: { id: f.cliente_id, nombre: f.cliente },
      })),
    };
  }

  /** La lista en CSV, con lo que se necesita para operar. Nunca contraseñas ni cédulas (`docs/SEGURIDAD.md` §4.3). */
  async exportar(
    filtro: FiltroLicencias,
    q: string,
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ): Promise<string> {
    const parametros: unknown[] = [];
    const busqueda = condicionBusqueda(q, parametros);
    const filas = (await this.fuente.query(
      `${CONSULTA_LISTA} WHERE ${CONDICION[filtro]} AND ${busqueda}
        ORDER BY l.ends_at ASC NULLS LAST, l.created_at DESC`,
      parametros,
    )) as FilaLicencia[];
    await this.auditoria.registrar({
      actorId: sesion.usuarioId,
      actorRole: sesion.rol,
      action: 'licencias.exportadas',
      targetType: 'license',
      targetId: null,
      metadata: { filtro, busqueda: q.trim().slice(0, 80) || null, filas: filas.length },
      ip: cliente.ip,
      userAgent: cliente.userAgent ?? null,
    });
    const fecha = (d: Date | null) => (d ? fechaSinHora(d) : '');
    return aCsv(
      [
        'Cuenta',
        'Broker',
        'Servidor',
        'Cliente',
        'Correo',
        'Teléfono',
        'Plan',
        'Estado',
        'Conexión',
        'Inicio',
        'Vence',
        'Fin de la gracia',
        'Capital recomendado (USD)',
        'Riesgo',
      ],
      filas.map((f) => [
        f.numero,
        f.broker,
        f.servidor,
        f.cliente,
        f.correo,
        f.telefono ?? '',
        f.plan ?? '',
        f.status,
        f.conexion,
        fecha(f.starts_at),
        fecha(f.ends_at),
        fecha(f.grace_ends_at),
        f.capital === null ? '' : String(f.capital / 100),
        f.riesgo ?? '',
      ]),
    );
  }

  /** La ficha: licencia, cuenta, cliente, sus otras cuentas, periodos y pagos. */
  async ficha(id: string) {
    const m = this.fuente.manager;
    const licencia = await m.getRepository(License).findOneBy({ id });
    if (!licencia) throw noEncontrada();
    const [cuenta, cliente, periodos, ordenes, otras, plan] = await Promise.all([
      m
        .getRepository(TradingAccount)
        .createQueryBuilder('t')
        .addSelect('t.internalNotes')
        .where('t.id = :id', { id: licencia.tradingAccountId })
        .getOneOrFail(),
      m.getRepository(User).findOneByOrFail({ id: licencia.userId }),
      m.query(
        `SELECT lp.kind, lp.period_start, lp.period_end, lp.note, p.name AS plan, o.number AS orden,
                u.full_name AS creado_por
           FROM license_periods lp
           JOIN plans p ON p.id = lp.plan_id
           LEFT JOIN payment_orders o ON o.id = lp.payment_order_id
           LEFT JOIN users u ON u.id = lp.created_by
          WHERE lp.license_id = $1 ORDER BY lp.period_start DESC, lp.created_at DESC`,
        [id],
      ) as Promise<
        {
          kind: TipoPeriodo;
          period_start: Date;
          period_end: Date;
          note: string | null;
          plan: string;
          orden: string | null;
          creado_por: string | null;
        }[]
      >,
      m.query(
        `SELECT o.number, o.type, o.status, o.currency, o.amount_usd_cents, o.created_at, o.decided_at,
                p.name AS plan
           FROM payment_orders o JOIN plans p ON p.id = o.plan_id
          WHERE o.license_id = $1 AND o.status IN ('REPORTADA', 'APROBADA', 'RECHAZADA')
          ORDER BY o.created_at DESC LIMIT 10`,
        [id],
      ) as Promise<
        {
          number: string;
          type: TipoOrden;
          status: EstadoOrden;
          currency: Moneda;
          amount_usd_cents: number;
          created_at: Date;
          decided_at: Date | null;
          plan: string;
        }[]
      >,
      m.query(
        `SELECT l.id, l.status, t.account_number AS numero, t.broker
           FROM licenses l JOIN trading_accounts t ON t.id = l.trading_account_id AND t.deleted_at IS NULL
          WHERE l.user_id = $1 AND l.id <> $2 ORDER BY t.created_at`,
        [licencia.userId, id],
      ) as Promise<{ id: string; status: EstadoLicencia; numero: string; broker: string }[]>,
      licencia.planId
        ? (m.query(`SELECT name FROM plans WHERE id = $1`, [licencia.planId]) as Promise<
            { name: string }[]
          >)
        : Promise.resolve([]),
    ]);
    return {
      id: licencia.id,
      estado: licencia.status,
      plan: plan[0]?.name ?? null,
      inicio: licencia.startsAt,
      vence: licencia.endsAt,
      finGracia: licencia.graceEndsAt,
      suspension: licencia.suspendedAt
        ? { fecha: licencia.suspendedAt, motivo: licencia.suspensionReason }
        : null,
      cuenta: {
        id: cuenta.id,
        titular: cuenta.holderName,
        broker: cuenta.broker,
        servidor: cuenta.server,
        numero: cuenta.accountNumber,
        conexion: cuenta.connectionStatus,
        conectadaEn: cuenta.connectedAt,
        capitalUsdCentavos: cuenta.recommendedCapitalUsdCents,
        riesgo: cuenta.riskLevel,
        notas: cuenta.internalNotes,
      },
      cliente: {
        id: cliente.id,
        nombre: cliente.fullName,
        correo: cliente.email,
        correoVerificado: cliente.emailVerifiedAt !== null,
        telefono: cliente.phoneE164,
        cedulaFinal: cliente.cedulaLast4,
        documentoPais: cliente.documentCountry,
        documentoTipo: cliente.documentType,
        desde: cliente.createdAt,
        estado: cliente.status,
      },
      otrasCuentas: otras.map((o) => ({
        licenciaId: o.id,
        estado: o.status,
        numero: o.numero,
        broker: o.broker,
      })),
      periodos: periodos.map((p) => ({
        tipo: p.kind,
        inicio: p.period_start,
        fin: p.period_end,
        plan: p.plan,
        orden: p.orden,
        nota: p.note,
        creadoPor: p.creado_por,
      })),
      pagos: ordenes.map((o) => ({
        numero: o.number,
        tipo: o.type,
        estado: o.status,
        moneda: o.currency,
        montoUsdCentavos: o.amount_usd_cents,
        plan: o.plan,
        creadaEn: o.created_at,
        decididaEn: o.decided_at,
      })),
    };
  }

  /** La cédula completa, solo bajo acción explícita y con registro en la auditoría (`docs/SEGURIDAD.md` §8). */
  async verCedula(usuarioId: string, sesion: SesionActiva, cliente: ContextoCliente) {
    const usuario = await this.fuente.getRepository(User).findOneBy({ id: usuarioId });
    if (!usuario?.cedulaEnc) {
      throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'Este cliente no tiene cédula.');
    }
    await this.auditoria.registrar({
      actorId: sesion.usuarioId,
      actorRole: sesion.rol,
      action: 'cliente.ver_cedula',
      targetType: 'user',
      targetId: usuario.id,
      metadata: {},
      ip: cliente.ip,
      userAgent: cliente.userAgent ?? null,
    });
    return { cedula: this.cifrado.descifrar(usuario.cedulaEnc, CONTEXTO_ACCESO.cedula) };
  }

  /**
   * Suma días sin pago, para compensar una falla. Se suman al vencimiento actual; si la licencia ya venció, desde
   * hoy. Queda como un periodo `EXTENSION_ADMIN` con su motivo, en la auditoría y con un correo al cliente.
   */
  async extender(
    id: string,
    dias: number,
    motivo: string,
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ) {
    return this.fuente.transaction(async (m) => {
      const licencia = await this.bloquear(m, id);
      const extensible: EstadoLicencia[] = [
        ESTADO_LICENCIA.ACTIVA,
        ESTADO_LICENCIA.EN_GRACIA,
        ESTADO_LICENCIA.VENCIDA,
        ESTADO_LICENCIA.SUSPENDIDA,
      ];
      if (!extensible.includes(licencia.status) || !licencia.endsAt || !licencia.planId) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'NO_EXTENSIBLE',
          licencia.status === ESTADO_LICENCIA.PENDIENTE_PAGO
            ? 'Esta licencia todavía no tiene un pago aprobado: no hay días que extender.'
            : 'Esta licencia no se puede extender.',
        );
      }
      const dueno = await m.getRepository(User).findOneByOrFail({ id: licencia.userId });
      if (dueno.status === ESTADO_USUARIO.BORRADO) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'CLIENTE_ELIMINADO',
          'El cliente pidió eliminar su cuenta: su licencia ya no se puede extender.',
        );
      }
      const ahora = new Date();
      // Si ya se acabó la gracia, los días cuentan desde hoy: no se gastan en un tiempo que ya pasó.
      const finGracia = licencia.graceEndsAt ?? licencia.endsAt;
      const inicio = finGracia <= ahora ? ahora : licencia.endsAt;
      const fin = sumarDias(inicio, dias);
      const ajustes = await leerAjustes(m);
      const nuevoFinGracia = sumarDias(fin, ajustes.diasGracia);

      await m.getRepository(LicensePeriod).insert({
        licenseId: licencia.id,
        paymentOrderId: null,
        planId: licencia.planId,
        kind: TIPO_PERIODO.EXTENSION_ADMIN,
        periodStart: inicio,
        periodEnd: fin,
        bonusMonths: 0,
        note: motivo,
        createdBy: sesion.usuarioId,
      });
      // Una suspendida sigue suspendida con sus fechas nuevas; las demás quedan en el estado de sus fechas.
      const estado =
        licencia.status === ESTADO_LICENCIA.SUSPENDIDA
          ? ESTADO_LICENCIA.SUSPENDIDA
          : fin > ahora
            ? ESTADO_LICENCIA.ACTIVA
            : ESTADO_LICENCIA.EN_GRACIA;
      await m
        .getRepository(License)
        .update({ id }, { status: estado, endsAt: fin, graceEndsAt: nuevoFinGracia });
      const cuenta = await m
        .getRepository(TradingAccount)
        .findOneByOrFail({ id: licencia.tradingAccountId });
      if (estado !== ESTADO_LICENCIA.SUSPENDIDA) {
        const conexion = conexionAlActivar(cuenta.connectionStatus);
        if (conexion !== cuenta.connectionStatus) {
          await m
            .getRepository(TradingAccount)
            .update({ id: cuenta.id }, { connectionStatus: conexion });
        }
      }
      await this.avisos.encolar(m, {
        usuarioId: dueno.id,
        correo: dueno.email,
        plantilla: PLANTILLA.LICENCIA_EXTENDIDA,
        datos: {
          nombre: dueno.fullName.split(' ')[0] ?? dueno.fullName,
          dias: texto(dias),
          cuenta: cuenta.accountNumber,
          vence: fechaSinHora(fin),
        },
        clave: `licencia-extendida:${licencia.id}:${fin.getTime()}`,
      });
      await this.registrar(m, sesion, cliente, 'licencia.extendida', licencia, {
        dias,
        motivo,
        antes: licencia.endsAt.toISOString(),
        despues: fin.toISOString(),
      });
      return { vence: fin };
    });
  }

  /**
   * Suspender ante un problema con el cliente. La cuenta pasa a "por desconectar" aunque la licencia siga vigente,
   * y los días siguen corriendo (`docs/MODELO-DATOS.md` §6, regla 5).
   */
  async suspender(id: string, motivo: string, sesion: SesionActiva, cliente: ContextoCliente) {
    await this.fuente.transaction(async (m) => {
      const licencia = await this.bloquear(m, id);
      const suspendible: EstadoLicencia[] = [ESTADO_LICENCIA.ACTIVA, ESTADO_LICENCIA.EN_GRACIA];
      if (!suspendible.includes(licencia.status)) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'NO_SUSPENDIBLE',
          'Solo se suspende una licencia vigente (activa o en gracia).',
        );
      }
      await m.getRepository(License).update(
        { id },
        {
          status: ESTADO_LICENCIA.SUSPENDIDA,
          suspendedAt: new Date(),
          suspendedBy: sesion.usuarioId,
          suspensionReason: motivo,
        },
      );
      await this.moverConexion(m, licencia.tradingAccountId, conexionAlDesactivar);
      await this.registrar(m, sesion, cliente, 'licencia.suspendida', licencia, {
        motivo,
        estadoAnterior: licencia.status,
      });
    });
  }

  /** Quita la suspensión. La licencia vuelve al estado que le toca por sus fechas. */
  async reactivar(id: string, sesion: SesionActiva, cliente: ContextoCliente) {
    await this.fuente.transaction(async (m) => {
      const licencia = await this.bloquear(m, id);
      if (licencia.status !== ESTADO_LICENCIA.SUSPENDIDA) {
        throw errorApi(HttpStatus.CONFLICT, 'NO_SUSPENDIDA', 'Esta licencia no está suspendida.');
      }
      const ahora = new Date();
      const estado: EstadoLicencia =
        licencia.endsAt && licencia.endsAt > ahora
          ? ESTADO_LICENCIA.ACTIVA
          : licencia.graceEndsAt && licencia.graceEndsAt > ahora
            ? ESTADO_LICENCIA.EN_GRACIA
            : ESTADO_LICENCIA.VENCIDA;
      await m
        .getRepository(License)
        .update(
          { id },
          { status: estado, suspendedAt: null, suspendedBy: null, suspensionReason: null },
        );
      if (estado !== ESTADO_LICENCIA.VENCIDA) {
        await this.moverConexion(m, licencia.tradingAccountId, conexionAlActivar);
      }
      await this.registrar(m, sesion, cliente, 'licencia.reactivada', licencia, { estado });
    });
  }

  private async moverConexion(
    m: EntityManager,
    cuentaId: string,
    regla: (actual: EstadoConexion) => EstadoConexion,
  ) {
    const cuenta = await m.getRepository(TradingAccount).findOneByOrFail({ id: cuentaId });
    const conexion = regla(cuenta.connectionStatus);
    if (conexion !== cuenta.connectionStatus) {
      await m
        .getRepository(TradingAccount)
        .update({ id: cuentaId }, { connectionStatus: conexion });
    }
  }

  private async bloquear(m: EntityManager, id: string) {
    const licencia = await m
      .getRepository(License)
      .createQueryBuilder('l')
      .setLock('pessimistic_write')
      .where('l.id = :id', { id })
      .getOne();
    if (!licencia) throw noEncontrada();
    return licencia;
  }

  private registrar(
    m: EntityManager,
    sesion: SesionActiva,
    cliente: ContextoCliente,
    accion: string,
    licencia: License,
    extra: Record<string, unknown>,
  ) {
    return this.auditoria.registrar(
      {
        actorId: sesion.usuarioId,
        actorRole: sesion.rol,
        action: accion,
        targetType: 'license',
        targetId: licencia.id,
        metadata: extra,
        ip: cliente.ip,
        userAgent: cliente.userAgent ?? null,
      },
      m,
    );
  }
}

function noEncontrada() {
  return errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'No encontramos esa licencia.');
}
