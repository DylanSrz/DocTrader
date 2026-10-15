import {
  type CodigoPlan,
  deUnidadesBase,
  enlaceExplorador,
  ESTADO_ORDEN,
  type EstadoOrden,
  vencimientoSiSeAprueba,
} from '@doctrader/shared';
import type {
  License,
  LicensePeriod,
  PaymentOrder,
  Plan,
  TradingAccount,
} from '../database/entidades/index.js';

/**
 * Lo que ve el cliente de sus cuentas, licencias y órdenes. Nunca incluye contraseñas, huellas ni notas internas.
 */

export function vistaPlan(plan: Plan) {
  return {
    codigo: plan.code as CodigoPlan,
    nombre: plan.name,
    meses: plan.durationMonths,
    mesesObsequio: plan.bonusMonths,
    dias: plan.durationDays,
    precioUsdCentavos: plan.priceUsdCents,
    rango: plan.rank,
  };
}

export function vistaCuenta(
  cuenta: TradingAccount,
  licencia: License,
  periodos: LicensePeriod[],
  planes: Map<string, Plan>,
  ordenAbierta: PaymentOrder | null,
) {
  const plan = licencia.planId ? planes.get(licencia.planId) : undefined;
  return {
    id: cuenta.id,
    titular: cuenta.holderName,
    broker: cuenta.broker,
    servidor: cuenta.server,
    numero: cuenta.accountNumber,
    conexion: cuenta.connectionStatus,
    capitalRecomendadoUsdCentavos: cuenta.recommendedCapitalUsdCents,
    riesgo: cuenta.riskLevel,
    bloqueadaHasta: cuenta.lockedUntil,
    creadaEn: cuenta.createdAt,
    licencia: {
      id: licencia.id,
      estado: licencia.status,
      esPrueba: licencia.isTrial,
      inicioPrueba: licencia.trialStartedAt,
      plan: plan ? vistaPlan(plan) : null,
      inicio: licencia.startsAt,
      fin: licencia.endsAt,
      finGracia: licencia.graceEndsAt,
      periodos: periodos.map((p) => ({
        tipo: p.kind,
        plan: planes.get(p.planId)?.code ?? null,
        inicio: p.periodStart,
        fin: p.periodEnd,
        mesesObsequio: p.bonusMonths,
      })),
    },
    ordenAbierta: ordenAbierta
      ? {
          numero: ordenAbierta.number,
          estado: estadoVisible(ordenAbierta),
          expiraEn: ordenAbierta.expiresAt,
        }
      : null,
  };
}

/** Una orden pendiente cuya hora ya pasó se muestra como expirada aunque el worker aún no la haya marcado. */
export function estadoVisible(orden: PaymentOrder, ahora = new Date()): EstadoOrden {
  return orden.status === ESTADO_ORDEN.PENDIENTE && orden.expiresAt <= ahora
    ? ESTADO_ORDEN.EXPIRADA
    : orden.status;
}

export function vistaOrden(
  orden: PaymentOrder,
  plan: Plan,
  cuenta: TradingAccount,
  licencia: License,
  confirmacionesNecesarias: number,
) {
  const vence = vencimientoSiSeAprueba(
    orden.type,
    { finActual: licencia.endsAt, inicioPrueba: licencia.trialStartedAt },
    plan,
  );
  return {
    id: orden.id,
    numero: orden.number,
    tipo: orden.type,
    estado: estadoVisible(orden),
    plan: vistaPlan(plan),
    cuenta: { id: cuenta.id, numero: cuenta.accountNumber, broker: cuenta.broker },
    precioUsdCentavos: orden.priceUsdCents,
    creditoUsdCentavos: orden.creditUsdCents,
    montoUsdCentavos: orden.amountUsdCents,
    moneda: orden.currency,
    red: orden.network,
    direccion: orden.depositAddress,
    monto: deUnidadesBase(BigInt(orden.amountBaseUnits), orden.currency),
    precioBtcUsd: orden.btcUsdRate,
    creadaEn: orden.createdAt,
    expiraEn: orden.expiresAt,
    hash: orden.txHash,
    enlaceExplorador: orden.txHash ? enlaceExplorador(orden.network, orden.txHash) : null,
    reportadaEn: orden.reportedAt,
    verificacion: orden.verificationStatus,
    confirmaciones: orden.confirmations,
    confirmacionesNecesarias,
    vencimientoSiSeAprueba: orden.status === ESTADO_ORDEN.APROBADA ? null : vence,
    motivoRechazo: orden.rejectionReason,
  };
}
