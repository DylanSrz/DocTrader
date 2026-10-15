import {
  aplicarPorcentaje,
  ESTADO_CONEXION,
  ESTADO_LICENCIA,
  ESTADO_ORDEN,
  ESTADO_VERIFICACION,
  finDePeriodo,
  sumarDias,
  TIPO_ORDEN,
} from '@doctrader/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService } from '../avisos/avisos.service.js';
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
import { errorApi } from '../seguridad/errores.js';

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
    await this.fuente.transaction(async (m) => {
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
      if (orden.type === TIPO_ORDEN.PRUEBA || orden.type === TIPO_ORDEN.COMPLETAR_PRUEBA) {
        // Llegan en la etapa 6 (licencia de prueba).
        throw errorApi(
          HttpStatus.CONFLICT,
          'NO_DISPONIBLE',
          'Las pruebas todavía no se aprueban aquí.',
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

      // Renovar o cambiar de plan suma los días al vencimiento actual, también en la gracia (esos días cuentan
      // como usados). Si la licencia ya venció o nunca se pagó, el periodo empieza hoy.
      const continua =
        (orden.type === TIPO_ORDEN.RENOVACION || orden.type === TIPO_ORDEN.CAMBIO_DE_PLAN) &&
        (licencia.status === ESTADO_LICENCIA.ACTIVA ||
          licencia.status === ESTADO_LICENCIA.EN_GRACIA) &&
        licencia.endsAt !== null;
      const inicio = continua ? licencia.endsAt! : ahora;
      const fin = finDePeriodo(inicio, plan);

      await m.getRepository(LicensePeriod).insert({
        licenseId: licencia.id,
        paymentOrderId: orden.id,
        planId: plan.id,
        kind: orden.type,
        periodStart: inicio,
        periodEnd: fin,
        bonusMonths: plan.bonusMonths,
      });
      await m.getRepository(License).update(
        { id: licencia.id },
        {
          status: ESTADO_LICENCIA.ACTIVA,
          planId: plan.id,
          isTrial: false,
          startsAt: continua ? (licencia.startsAt ?? inicio) : inicio,
          endsAt: fin,
          graceEndsAt: sumarDias(fin, ajustes.diasGracia),
        },
      );

      const [socio] = (await m.query(
        `SELECT commission_bp FROM partner_profiles ORDER BY created_at LIMIT 1`,
      )) as { commission_bp: number }[];
      const porcentaje = socio?.commission_bp ?? 0;
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
      if (conexion !== cuenta.connectionStatus) {
        await m
          .getRepository(TradingAccount)
          .update({ id: cuenta.id }, { connectionStatus: conexion });
      }

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
      await this.registrar(m, decisor, 'pago.aprobado', orden, {
        modo: decisor.tipo === 'ADMIN' ? 'MANUAL' : 'AUTO',
        forzado: forzar && !verificada,
        verificacion: orden.verificationStatus,
        periodo: { inicio: inicio.toISOString(), fin: fin.toISOString() },
        comisionBp: porcentaje,
      });
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
