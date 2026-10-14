import { CODIGO_PLAN, type CodigoPlan } from './dominio.js';

export interface DefinicionPlan {
  code: CodigoPlan;
  name: string;
  /** Meses que se pagan; nulo en la prueba, que se mide en días. */
  durationMonths: number | null;
  /** Meses de obsequio que se suman (el semestral trae 1). */
  bonusMonths: number;
  durationDays: number | null;
  priceUsdCents: number;
  /** Orden de "más corto" a "más largo", para los cambios de plan. */
  rank: number;
  isPublic: boolean;
}

/** Planes con los que arranca la plataforma (decisiones del 2026-10-12). Los precios se editan desde el admin. */
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
    code: CODIGO_PLAN.TRIMESTRAL,
    name: 'Trimestral',
    durationMonths: 3,
    bonusMonths: 0,
    durationDays: null,
    priceUsdCents: 31_900,
    rank: 2,
    isPublic: true,
  },
  {
    code: CODIGO_PLAN.SEMESTRAL,
    name: 'Semestral',
    durationMonths: 6,
    bonusMonths: 1,
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
