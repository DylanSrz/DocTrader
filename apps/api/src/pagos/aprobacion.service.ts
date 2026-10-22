import {
  aplicarPorcentaje,
  ESTADO_CONEXION,
  formatearPorcentaje,
  ESTADO_LICENCIA,
  ESTADO_ORDEN,
  ESTADO_VERIFICACION,
  finDePeriodo,
  formatearUsd,
  interpretarReferencia,
  nombreReservado,
  PREFIJO_MANUAL,
  sumarDias,
  TIPO_ORDEN,
  type TipoOrden,
} from '@doctrader/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type EntityManager, In, Not, QueryFailedError } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService, primerNombre } from '../avisos/avisos.service.js';
import { fechaSinHora } from '../avisos/fecha.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import {
  License,
  LicensePeriod,
  PaymentOrder,
  Plan,
  TradingAccount,
  User,
} from '../database/entidades/index.js';
import { leerAjustes } from '../licencias/ajustes.js';
import { conexionAlActivar } from '../licencias/conexion.js';
import { comisionesDeReferidos, rutaReferidos } from '../referidos/reglas.js';
import { errorApi, errorDeCampos } from '../seguridad/errores.js';

/** Quién decide: un admin (con su IP y navegador, para la auditoría) o el sistema, con la aprobación automática. */
export type Decisor =
  { tipo: 'ADMIN'; id: string; ip: string; userAgent?: string } | { tipo: 'SISTEMA' };

function noRevisable(numero: string) {
  return errorApi(
    HttpStatus.CONFLICT,
    'NO_REVISABLE',
    `La orden ${numero} ya no está por revisar. Recarga la página.`,
  );
}

/**
 * Las fechas que deja un pago aprobado (`docs/MODELO-DATOS.md` §4.1):
 * - RENOVACION o CAMBIO_DE_PLAN con la licencia activa o en gracia: se suma al vencimiento actual (los días de
 *   gracia cuentan como usados). Si ya venció o nunca se pagó, desde hoy.
 */
export function fechasAlAprobar(
  tipo: TipoOrden,
  licencia: License,
  plan: Plan,
  diasGracia: number,
  ahora: Date,
): { inicio: Date; fin: Date; cambios: Partial<License> } {
  const continua =
    (tipo === TIPO_ORDEN.RENOVACION || tipo === TIPO_ORDEN.CAMBIO_DE_PLAN) &&
    (licencia.status === ESTADO_LICENCIA.ACTIVA || licencia.status === ESTADO_LICENCIA.EN_GRACIA) &&
    licencia.endsAt !== null;
  const inicio = continua ? licencia.endsAt! : ahora;
  const fin = finDePeriodo(inicio, plan);
  return {
    inicio,
    fin,
    cambios: {
      status: ESTADO_LICENCIA.ACTIVA,
      startsAt: continua ? (licencia.startsAt ?? inicio) : inicio,
      endsAt: fin,
      graceEndsAt: sumarDias(fin, diasGracia),
    },
  };
}

/**
 * Aprobar o rechazar un pago. Al aprobar, en una sola transacción (`docs/MODELO-DATOS.md` §4.2): se bloquea la
 * orden, se crea el periodo, se actualiza la licencia, se copia el % del socio, la cuenta pasa a "por conectar" y se
 * encola el correo. Si algo falla, no se aplica nada.
 */
@Injectable()
export class AprobacionPagos {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly auditoria: AuditoriaService,
    private readonly avisos: AvisosService,
  ) {}

  async aprobar(numero: string, decisor: Decisor, forzar = false): Promise<void> {
    await this.fuente.transaction((m) => this.aprobarEn(m, numero, decisor, forzar));
  }

  /**
   * Registrar a mano el pago de una orden pendiente o vencida y aprobarlo, en una sola transacción. Es para pagos que
   * el cliente no pudo reportar (por ejemplo, la orden venció mientras pagaba). Lo hace un admin con su código; el
   * motivo y la referencia quedan en la auditoría. Si la licencia tiene otra orden pendiente, se cancela para que no
   * se pague dos veces.
   */
  async registrarManual(
    numero: string,
    datos: { motivo: string; referencia?: string },
    decisor: Decisor & { tipo: 'ADMIN' },
  ): Promise<void> {
    const escrita = datos.referencia?.trim() ?? '';
    const referencia = escrita ? interpretarReferencia(escrita) : null;
    if (escrita && !referencia) {
      throw errorDeCampos({
        referencia:
          'Escribe el hash (64 letras y números) o el número de la transferencia de Binance, o déjalo vacío.',
      });
    }
    await this.fuente
      .transaction(async (m) => {
        const orden = await m
          .getRepository(PaymentOrder)
          .createQueryBuilder('o')
          .setLock('pessimistic_write')
          .where('o.number = :numero', { numero })
          .getOne();
        if (!orden) {
          throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'No encontramos esa orden.');
        }
        if (orden.status !== ESTADO_ORDEN.PENDIENTE && orden.status !== ESTADO_ORDEN.EXPIRADA) {
          throw errorApi(
            HttpStatus.CONFLICT,
            'NO_REGISTRABLE',
            orden.status === ESTADO_ORDEN.REPORTADA
              ? 'El cliente ya reportó este pago: apruébalo desde la lista de pagos por revisar.'
              : 'Solo se registra a mano el pago de una orden pendiente o vencida.',
          );
        }
        const otra = await m.getRepository(PaymentOrder).findOne({
          where: {
            licenseId: orden.licenseId,
            status: In([ESTADO_ORDEN.PENDIENTE, ESTADO_ORDEN.REPORTADA]),
            id: Not(orden.id),
          },
        });
        if (otra?.status === ESTADO_ORDEN.REPORTADA) {
          throw errorApi(
            HttpStatus.CONFLICT,
            'OTRA_EN_REVISION',
            `Esta licencia tiene otro pago en revisión (${otra.number}). Revísalo primero.`,
          );
        }
        if (otra) {
          await m
            .getRepository(PaymentOrder)
            .update({ id: otra.id }, { status: ESTADO_ORDEN.CANCELADA });
        }
        await m.getRepository(PaymentOrder).update(
          { id: orden.id },
          {
            status: ESTADO_ORDEN.REPORTADA,
            txHash: referencia ?? `${PREFIJO_MANUAL}${orden.number}`,
            reportedAt: new Date(),
            verificationDetail: { nota: `Registrado a mano: ${datos.motivo}` },
          },
        );
        await this.registrar(m, decisor, 'pago.registrado_manual', orden, {
          motivo: datos.motivo,
          referencia,
          estadoAnterior: orden.status,
          canceladaOtra: otra?.number ?? null,
        });
        await this.aprobarEn(m, numero, decisor, true);
      })
      .catch((error: unknown) => {
        if (
          error instanceof QueryFailedError &&
          (error.driverError as { constraint?: string }).constraint ===
            'payment_orders_hash_por_red'
        ) {
          throw errorDeCampos({ referencia: 'Esa referencia ya está registrada en otra orden.' });
        }
        throw error;
      });
  }

  private async aprobarEn(
    m: EntityManager,
    numero: string,
    decisor: Decisor,
    forzar: boolean,
  ): Promise<void> {
    const orden = await this.bloquearOrden(m, numero);
    const verificada = orden.verificationStatus === ESTADO_VERIFICACION.VERIFICADA;
    if (decisor.tipo === 'SISTEMA' && !verificada) throw noRevisable(numero);
    if (orden.verificationStatus === ESTADO_VERIFICACION.ESPERANDO_CONFIRMACIONES && !forzar) {
      throw errorApi(
        HttpStatus.CONFLICT,
        'ESPERANDO_CONFIRMACIONES',
        'El pago todavía no tiene todas las confirmaciones. Apruébalo cuando las complete.',
      );
    }
    if (!verificada && !forzar) {
      throw errorApi(
        HttpStatus.CONFLICT,
        'NO_VERIFICADO',
        'Este pago no pasó la verificación. Si lo revisaste en el explorador, apruébalo de todos modos.',
      );
    }
    const licencia = await m
      .getRepository(License)
      .createQueryBuilder('l')
      .setLock('pessimistic_write')
      .where('l.id = :id', { id: orden.licenseId })
      .getOneOrFail();
    const plan = await m.getRepository(Plan).findOneByOrFail({ id: orden.planId });
    const ajustes = await leerAjustes(m);
    const ahora = new Date();
    const { inicio, fin, cambios } = fechasAlAprobar(
      orden.type,
      licencia,
      plan,
      ajustes.diasGracia,
      ahora,
    );

    await m.getRepository(LicensePeriod).insert({
      licenseId: licencia.id,
      paymentOrderId: orden.id,
      planId: plan.id,
      kind: orden.type,
      periodStart: inicio,
      periodEnd: fin,
      bonusMonths: plan.bonusMonths,
    });
    await m.getRepository(License).update({ id: licencia.id }, { planId: plan.id, ...cambios });

    const [socio] = (await m.query(
      `SELECT commission_bp FROM partner_profiles ORDER BY created_at LIMIT 1`,
    )) as { commission_bp: number }[];
    const porcentaje = socio?.commission_bp ?? 0;
    // Las de los referidores (primera y segunda línea) se fijan igual: un cambio del % solo aplica a las ventas siguientes.
    const referidos = await comisionesDeReferidos(m, orden.userId, orden.amountUsdCents);
    await m.getRepository(PaymentOrder).update(
      { id: orden.id },
      {
        status: ESTADO_ORDEN.APROBADA,
        decidedBy: decisor.tipo === 'ADMIN' ? decisor.id : null,
        decidedAt: ahora,
        approvalMode: decisor.tipo === 'ADMIN' ? 'MANUAL' : 'AUTO',
        commissionBp: porcentaje,
        commissionUsdCents: aplicarPorcentaje(orden.amountUsdCents, porcentaje),
      },
    );

    const cuenta = await m
      .getRepository(TradingAccount)
      .findOneByOrFail({ id: orden.tradingAccountId });
    const conexion = conexionAlActivar(cuenta.connectionStatus);
    await m.getRepository(TradingAccount).update({ id: cuenta.id }, { connectionStatus: conexion });

    const cliente = await m.getRepository(User).findOneByOrFail({ id: orden.userId });
    await this.avisos.encolar(m, {
      usuarioId: cliente.id,
      correo: cliente.email,
      plantilla: PLANTILLA.PAGO_APROBADO,
      datos: {
        nombre: cliente.fullName.split(' ')[0] ?? cliente.fullName,
        orden: orden.number,
        plan: plan.name.toLowerCase(),
        cuenta: cuenta.accountNumber,
        vence: fechaSinHora(fin),
        conectar: conexion === ESTADO_CONEXION.CONECTADA ? 'no' : 'si',
      },
      clave: `pago-aprobado:${orden.id}`,
    });
    for (const r of referidos) {
      await m.query(
        `INSERT INTO referral_commissions (payment_order_id, referrer_id, level, bp, usd_cents, earned_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orden.id, r.referidorId, r.nivel, r.bp, r.usdCents, ahora],
      );
      if (r.usdCents === 0) continue;
      await this.avisos.encolar(m, {
        usuarioId: r.referidorId,
        correo: r.referidor.correo,
        plantilla: PLANTILLA.REFERIDO_COMISION,
        datos: {
          nombre: primerNombre(r.referidor.nombre),
          referido: nombreReservado(cliente.fullName),
          via: r.via ? nombreReservado(r.via) : '',
          plan: plan.name.toLowerCase(),
          comision: formatearUsd(r.usdCents),
          porcentaje: formatearPorcentaje(r.bp),
          monto: formatearUsd(orden.amountUsdCents),
          direccion: r.referidor.direccion ? 'si' : 'no',
          ruta: rutaReferidos(r.referidor.rol),
        },
        clave: `referido-comision:${orden.id}:${r.nivel}`,
      });
    }
    const quien =
      decisor.tipo === 'ADMIN'
        ? `${primerNombre((await m.getRepository(User).findOneByOrFail({ id: decisor.id })).fullName)} aprobó`
        : 'La aprobación automática aprobó';
    await this.avisos.avisarAdmins(m, PLANTILLA.VENTA_APROBADA, {
      clave: `venta:${orden.id}`,
      datos: {
        quien,
        orden: orden.number,
        plan: plan.name.toLowerCase(),
        cliente: cliente.fullName,
        cuenta: cuenta.accountNumber,
        monto: formatearUsd(orden.amountUsdCents),
        conectar: conexion === ESTADO_CONEXION.POR_CONECTAR ? 'si' : 'no',
      },
    });
    await this.registrar(m, decisor, 'pago.aprobado', orden, {
      modo: decisor.tipo === 'ADMIN' ? 'MANUAL' : 'AUTO',
      forzado: forzar && !verificada,
      verificacion: orden.verificationStatus,
      periodo: { inicio: inicio.toISOString(), fin: fin.toISOString() },
      comisionBp: porcentaje,
      referidos: referidos.map((r) => ({
        nivel: r.nivel,
        referidorId: r.referidorId,
        bp: r.bp,
        usdCentavos: r.usdCents,
      })),
    });
  }

  async rechazar(numero: string, motivo: string, decisor: Decisor & { tipo: 'ADMIN' }) {
    await this.fuente.transaction(async (m) => {
      const orden = await this.bloquearOrden(m, numero);
      await m.getRepository(PaymentOrder).update(
        { id: orden.id },
        {
          status: ESTADO_ORDEN.RECHAZADA,
          rejectionReason: motivo,
          decidedBy: decisor.id,
          decidedAt: new Date(),
          approvalMode: 'MANUAL',
        },
      );
      const cliente = await m.getRepository(User).findOneByOrFail({ id: orden.userId });
      await this.avisos.encolar(m, {
        usuarioId: cliente.id,
        correo: cliente.email,
        plantilla: PLANTILLA.PAGO_RECHAZADO,
        datos: {
          nombre: cliente.fullName.split(' ')[0] ?? cliente.fullName,
          orden: orden.number,
          motivo,
        },
        clave: `pago-rechazado:${orden.id}`,
      });
      await this.registrar(m, decisor, 'pago.rechazado', orden, { motivo });
    });
  }

  private async bloquearOrden(m: EntityManager, numero: string) {
    const orden = await m
      .getRepository(PaymentOrder)
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.number = :numero', { numero })
      .getOne();
    if (!orden) throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'No encontramos esa orden.');
    if (orden.status !== ESTADO_ORDEN.REPORTADA) throw noRevisable(numero);
    return orden;
  }

  private registrar(
    m: EntityManager,
    decisor: Decisor,
    accion: string,
    orden: PaymentOrder,
    extra: Record<string, unknown>,
  ) {
    return this.auditoria.registrar(
      {
        actorId: decisor.tipo === 'ADMIN' ? decisor.id : null,
        actorRole: decisor.tipo === 'ADMIN' ? 'ADMIN' : 'SYSTEM',
        action: accion,
        targetType: 'payment_order',
        targetId: orden.id,
        metadata: {
          numero: orden.number,
          montoUsdCentavos: orden.amountUsdCents,
          moneda: orden.currency,
          ...extra,
        },
        ip: decisor.tipo === 'ADMIN' ? decisor.ip : null,
        userAgent: decisor.tipo === 'ADMIN' ? (decisor.userAgent ?? null) : null,
      },
      m,
    );
  }
}
