import {
  ESTADO_ORDEN,
  ESTADO_VERIFICACION,
  MONEDA,
  NOMBRE_RED,
  normalizarHash,
  RED_DE_MONEDA,
  tipoDeOrden,
} from '@doctrader/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type EntityManager, In, QueryFailedError } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { License, PaymentOrder, Plan, TradingAccount } from '../database/entidades/index.js';
import { errorApi, errorDeCampos } from '../seguridad/errores.js';
import { LIMITES, LimitesService } from '../seguridad/limites.service.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { leerAjustes } from './ajustes.js';
import { CuentasService } from './cuentas.service.js';
import type { NuevaOrdenDto } from './dto.js';
import { centavosATexto, satoshisPara } from './precio-btc.js';
import { PrecioBtcService } from './precio-btc.service.js';
import { vistaOrden } from './vista.js';

/** USDT tiene 6 decimales: un centavo de dólar son 10.000 unidades base. */
const UNIDADES_USDT_POR_CENTAVO = 10_000n;

const MENSAJES_TIPO = {
  PLAN_NO_DISPONIBLE: 'Esa licencia no está disponible.',
  LICENCIA_SUSPENDIDA: 'Esta licencia está suspendida. Escríbenos a soporte.',
} as const;

function noEncontrada() {
  return errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'No encontramos esa orden.');
}

function restriccion(error: unknown): string | undefined {
  return error instanceof QueryFailedError
    ? (error.driverError as { constraint?: string }).constraint
    : undefined;
}

/**
 * Órdenes de pago (`docs/MODELO-DATOS.md` §4.2): se crean con el precio del plan y la dirección vigentes, valen
 * una hora y el cliente reporta el hash de su envío. La verificación en la blockchain y la aprobación llegan en
 * la etapa 4.
 */
@Injectable()
export class OrdenesService {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly cuentas: CuentasService,
    private readonly precioBtc: PrecioBtcService,
    private readonly limites: LimitesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async crear(dto: NuevaOrdenDto, sesion: SesionActiva, cliente: ContextoCliente) {
    await this.limites.exigir(LIMITES.ordenesPorUsuario, sesion.usuarioId);
    // El precio se consulta antes de abrir la transacción: no se tiene una fila bloqueada esperando a un tercero.
    const centavosPorBtc = dto.moneda === MONEDA.BTC ? await this.precioBtc.cotizar() : null;
    const red = RED_DE_MONEDA[dto.moneda];

    const numero = await this.fuente
      .transaction(async (m) => {
        const cuenta = await this.cuentas.propia(m, sesion.usuarioId, dto.cuentaId);
        const licencia = await m
          .getRepository(License)
          .createQueryBuilder('l')
          .setLock('pessimistic_write')
          .where('l.trading_account_id = :id', { id: cuenta.id })
          .getOneOrFail();
        const plan = await m.getRepository(Plan).findOneBy({ code: dto.plan, isActive: true });
        if (!plan)
          throw errorApi(
            HttpStatus.BAD_REQUEST,
            'PLAN_NO_DISPONIBLE',
            MENSAJES_TIPO.PLAN_NO_DISPONIBLE,
          );
        const planActual = licencia.planId
          ? await m.getRepository(Plan).findOneBy({ id: licencia.planId })
          : null;
        const resultado = tipoDeOrden(
          { estado: licencia.status, rangoPlan: planActual?.rank ?? null },
          plan,
        );
        if ('error' in resultado) {
          throw errorApi(HttpStatus.CONFLICT, resultado.error, MENSAJES_TIPO[resultado.error]);
        }

        await this.cerrarAbierta(m, licencia.id);

        const direccion = (await m.query(
          `SELECT id, address FROM deposit_addresses
            WHERE network = $1 AND status = 'ACTIVA' AND activates_at <= now()
            ORDER BY activates_at DESC LIMIT 1`,
          [red],
        )) as { id: string; address: string }[];
        if (!direccion[0]) {
          throw errorApi(
            HttpStatus.SERVICE_UNAVAILABLE,
            'SIN_DIRECCION',
            `Por ahora no estamos recibiendo pagos por ${NOMBRE_RED[red]}. Elige otra moneda o escríbenos a soporte.`,
          );
        }

        const ajustes = await leerAjustes(m);
        const ahora = new Date();
        const montoUsd = plan.priceUsdCents;
        const unidades =
          centavosPorBtc === null
            ? BigInt(montoUsd) * UNIDADES_USDT_POR_CENTAVO
            : satoshisPara(montoUsd, centavosPorBtc);

        const insertada = await m.getRepository(PaymentOrder).insert({
          userId: sesion.usuarioId,
          tradingAccountId: cuenta.id,
          licenseId: licencia.id,
          planId: plan.id,
          type: resultado.tipo,
          priceUsdCents: plan.priceUsdCents,
          creditUsdCents: 0,
          amountUsdCents: montoUsd,
          currency: dto.moneda,
          network: red,
          depositAddressId: direccion[0].id,
          depositAddress: direccion[0].address,
          amountBaseUnits: unidades.toString(),
          btcUsdRate: centavosPorBtc === null ? null : centavosATexto(centavosPorBtc),
          expiresAt: new Date(ahora.getTime() + ajustes.minutosOrden * 60_000),
          status: ESTADO_ORDEN.PENDIENTE,
        });
        const id = insertada.identifiers[0]!.id as string;
        const orden = await m.getRepository(PaymentOrder).findOneByOrFail({ id });
        await this.auditoria.registrar(
          {
            actorId: sesion.usuarioId,
            actorRole: sesion.rol,
            action: 'orden.creada',
            targetType: 'payment_order',
            targetId: orden.id,
            metadata: {
              numero: orden.number,
              tipo: resultado.tipo,
              plan: plan.code,
              moneda: dto.moneda,
              montoUsdCentavos: montoUsd,
            },
            ip: cliente.ip,
            userAgent: cliente.userAgent ?? null,
          },
          m,
        );
        return orden.number;
      })
      .catch((error: unknown) => {
        if (restriccion(error) === 'payment_orders_una_abierta') {
          throw errorApi(
            HttpStatus.CONFLICT,
            'ORDEN_EN_CURSO',
            'Ya hay una orden en curso para esta cuenta. Recarga la página.',
          );
        }
        throw error;
      });
    return this.obtener(sesion.usuarioId, numero);
  }

  /**
   * Antes de crear otra orden para la licencia: la pendiente se reemplaza (el cliente cambió de plan o de moneda),
   * pero una con el pago ya reportado no, porque ese dinero ya va en camino.
   */
  private async cerrarAbierta(m: EntityManager, licenciaId: string) {
    const abierta = await m.getRepository(PaymentOrder).findOneBy({
      licenseId: licenciaId,
      status: In([ESTADO_ORDEN.PENDIENTE, ESTADO_ORDEN.REPORTADA]),
    });
    if (!abierta) return;
    if (abierta.status === ESTADO_ORDEN.REPORTADA) {
      throw errorApi(
        HttpStatus.CONFLICT,
        'PAGO_EN_REVISION',
        `Ya reportaste el pago de la orden ${abierta.number}. Espera a que lo revisemos antes de crear otra.`,
      );
    }
    await m.getRepository(PaymentOrder).update(
      { id: abierta.id },
      {
        status: abierta.expiresAt <= new Date() ? ESTADO_ORDEN.EXPIRADA : ESTADO_ORDEN.CANCELADA,
      },
    );
  }

  async reportar(
    numero: string,
    hashEscrito: string,
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ) {
    await this.limites.exigir(LIMITES.reportesPorUsuario, sesion.usuarioId);
    const hash = normalizarHash(hashEscrito);
    if (!hash) {
      throw errorDeCampos({
        hash: 'Pega el código completo de la transacción: son 64 letras y números.',
      });
    }
    await this.fuente
      .transaction(async (m) => {
        const orden = await this.propia(m, sesion.usuarioId, numero, true);
        if (orden.status === ESTADO_ORDEN.REPORTADA) {
          throw errorApi(
            HttpStatus.CONFLICT,
            'YA_REPORTADA',
            'Ya reportaste el pago de esta orden.',
          );
        }
        if (orden.status !== ESTADO_ORDEN.PENDIENTE || orden.expiresAt <= new Date()) {
          throw errorApi(
            HttpStatus.CONFLICT,
            'ORDEN_EXPIRADA',
            'Esta orden ya no está vigente. Si ya enviaste el pago, escríbenos a soporte con el código de la transacción.',
          );
        }
        const usado = await m
          .getRepository(PaymentOrder)
          .existsBy({ network: orden.network, txHash: hash });
        if (usado) throw hashUsado();
        await m.getRepository(PaymentOrder).update(
          { id: orden.id },
          {
            status: ESTADO_ORDEN.REPORTADA,
            txHash: hash,
            reportedAt: new Date(),
            verificationStatus: ESTADO_VERIFICACION.SIN_VERIFICAR,
          },
        );
        await this.auditoria.registrar(
          {
            actorId: sesion.usuarioId,
            actorRole: sesion.rol,
            action: 'orden.reportada',
            targetType: 'payment_order',
            targetId: orden.id,
            metadata: { numero: orden.number, red: orden.network, hash },
            ip: cliente.ip,
            userAgent: cliente.userAgent ?? null,
          },
          m,
        );
      })
      .catch((error: unknown) => {
        if (restriccion(error) === 'payment_orders_hash_por_red') throw hashUsado();
        throw error;
      });
    return this.obtener(sesion.usuarioId, numero);
  }

  async cancelar(numero: string, sesion: SesionActiva, cliente: ContextoCliente) {
    await this.fuente.transaction(async (m) => {
      const orden = await this.propia(m, sesion.usuarioId, numero, true);
      if (orden.status !== ESTADO_ORDEN.PENDIENTE) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'NO_CANCELABLE',
          orden.status === ESTADO_ORDEN.REPORTADA
            ? 'Ya reportaste el pago de esta orden: no se puede cancelar.'
            : 'Esta orden ya no está pendiente.',
        );
      }
      await m
        .getRepository(PaymentOrder)
        .update({ id: orden.id }, { status: ESTADO_ORDEN.CANCELADA });
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'orden.cancelada',
          targetType: 'payment_order',
          targetId: orden.id,
          metadata: { numero: orden.number },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
    return this.obtener(sesion.usuarioId, numero);
  }

  /** Las órdenes del cliente, de la más nueva a la más vieja. */
  async listar(usuarioId: string) {
    const m = this.fuente.manager;
    const ordenes = await m.getRepository(PaymentOrder).find({
      where: { userId: usuarioId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return this.vistas(m, ordenes);
  }

  async obtener(usuarioId: string, numero: string) {
    const orden = await this.propia(this.fuente.manager, usuarioId, numero);
    const [vista] = await this.vistas(this.fuente.manager, [orden]);
    return vista!;
  }

  private async propia(m: EntityManager, usuarioId: string, numero: string, bloquear = false) {
    if (!/^DTP-\d{6,}$/.test(numero)) throw noEncontrada();
    const consulta = m
      .getRepository(PaymentOrder)
      .createQueryBuilder('o')
      .where('o.number = :numero AND o.user_id = :usuarioId', { numero, usuarioId });
    if (bloquear) consulta.setLock('pessimistic_write');
    const orden = await consulta.getOne();
    if (!orden) throw noEncontrada();
    return orden;
  }

  private async vistas(m: EntityManager, ordenes: PaymentOrder[]) {
    if (ordenes.length === 0) return [];
    const [planes, cuentas, licencias, ajustes] = await Promise.all([
      m.getRepository(Plan).find(),
      m
        .getRepository(TradingAccount)
        .findBy({ id: In([...new Set(ordenes.map((o) => o.tradingAccountId))]) }),
      m.getRepository(License).findBy({ id: In([...new Set(ordenes.map((o) => o.licenseId))]) }),
      leerAjustes(m),
    ]);
    return ordenes.map((orden) =>
      vistaOrden(
        orden,
        planes.find((p) => p.id === orden.planId)!,
        cuentas.find((c) => c.id === orden.tradingAccountId)!,
        licencias.find((l) => l.id === orden.licenseId)!,
        ajustes.confirmaciones[orden.network],
      ),
    );
  }
}

function hashUsado() {
  return errorDeCampos({
    hash: 'Ese código ya se reportó en otra orden. Si crees que es un error, escríbenos a soporte.',
  });
}
