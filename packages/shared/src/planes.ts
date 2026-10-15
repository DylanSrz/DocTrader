import { CODIGO_PLAN, type CodigoPlan } from './dominio.js';

export interface DefinicionPlan {
  code: CodigoPlan;
  name: string;
  /** Meses que se pagan; nulo en la prueba, que se mide en días. */
  durationMonths: number | null;
  /** Meses de obsequio que se suman (hoy ningún plan trae; el semestral traía 1 hasta el 2026-10-15). */
  bonusMonths: number;
  durationDays: number | null;
  priceUsdCents: number;
  /** Orden de "más corto" a "más largo", para los cambios de plan. */
  rank: number;
  isPublic: boolean;
}

/**
 * Planes con los que arranca la plataforma (decisiones del 2026-10-12 y 2026-10-15: sin trimestral y la semestral sin
 * mes de obsequio). Los precios se editan desde el admin.
 */
export const PLANES_INICIALES: readonly DefinicionPlan[] = [
  {
    code: CODIGO_PLAN.MENSUAL,
    name: 'Mensual',
    durationMonths: 1,
    bonusMonths: 0,
    durationDays: null,
    priceUsdCents: 12_000,
    rank: 1,
    isPublic: true,
  },
  {
    code: CODIGO_PLAN.SEMESTRAL,
    name: 'Semestral',
    durationMonths: 6,
    bonusMonths: 0,
    durationDays: null,
    priceUsdCents: 49_900,
    rank: 3,
    isPublic: true,
  },
  {
    code: CODIGO_PLAN.PRUEBA,
    name: 'Prueba',
    durationMonths: null,
    bonusMonths: 0,
    durationDays: 15,
    priceUsdCents: 5_000,
    rank: 0,
    isPublic: false,
  },
];

/** Lo que paga quien completa la prueba: el precio del plan menos lo que ya pagó por la prueba. */
export function diferenciaParaCompletar(
  precioPlanCentavos: number,
  precioPruebaCentavos: number,
): number {
  if (precioPlanCentavos <= precioPruebaCentavos) {
    throw new Error('El plan debe costar más que la prueba para completarla');
  }
  return precioPlanCentavos - precioPruebaCentavos;
}

/** Meses que dura un plan, contando el obsequio si lo tiene. Nulo en la prueba. */
export function mesesTotales(plan: Pick<DefinicionPlan, 'durationMonths' | 'bonusMonths'>) {
  return plan.durationMonths === null ? null : plan.durationMonths + plan.bonusMonths;
}

/** Cuánto sale cada mes del plan, en dólares enteros, para "equivale a USD 106 al mes". */
export function dolaresPorMes(
  plan: Pick<DefinicionPlan, 'durationMonths' | 'bonusMonths' | 'priceUsdCents'>,
): number | null {
  const meses = mesesTotales(plan);
  return meses ? Math.round(plan.priceUsdCents / meses / 100) : null;
}
