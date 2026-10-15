import { TZDate } from '@date-fns/tz';
import { differenceInCalendarDays } from 'date-fns';
import {
  CODIGO_PLAN,
  type CodigoPlan,
  ESTADO_LICENCIA,
  type EstadoLicencia,
  TIPO_ORDEN,
  type TipoOrden,
} from './dominio.js';
import { sumarDias, sumarMeses, ZONA_HORARIA } from './fechas.js';
import type { DefinicionPlan } from './planes.js';

type DuracionPlan = Pick<DefinicionPlan, 'durationMonths' | 'bonusMonths' | 'durationDays'>;

/** Una licencia "vence pronto" cuando le quedan estos días o menos (no es un estado: es para la pantalla). */
export const DIAS_VENCE_PRONTO = 7;

/** Fin de un periodo: inicio + meses del plan + mes de obsequio, o + días en la prueba. */
export function finDePeriodo(inicio: Date, plan: DuracionPlan): Date {
  if (plan.durationMonths !== null) {
    return sumarMeses(inicio, plan.durationMonths + plan.bonusMonths);
  }
  if (plan.durationDays !== null) return sumarDias(inicio, plan.durationDays);
  throw new Error('El plan no tiene duración');
}

/** Días de calendario (en hora de Colombia) que faltan para una fecha; 0 si ya pasó. */
export function diasRestantes(fin: Date, ahora: Date = new Date()): number {
  const dias = differenceInCalendarDays(
    new TZDate(fin, ZONA_HORARIA),
    new TZDate(ahora, ZONA_HORARIA),
  );
  return Math.max(0, dias);
}

/** Días de calendario entre dos fechas, en hora de Colombia. */
export function diasEntre(desde: Date, hasta: Date): number {
  return differenceInCalendarDays(new TZDate(hasta, ZONA_HORARIA), new TZDate(desde, ZONA_HORARIA));
}

export type ResultadoTipoOrden =
  | { tipo: TipoOrden }
  | { error: 'PLAN_NO_DISPONIBLE' | 'LICENCIA_EN_PRUEBA' | 'LICENCIA_SUSPENDIDA' };

/**
 * Qué tipo de orden crea el cliente al elegir un plan para una licencia (`docs/MODELO-DATOS.md` §4.1):
 * - sin pagar o vencida → licencia NUEVA;
 * - activa o en gracia → a un plan más largo es CAMBIO_DE_PLAN; al mismo o a uno más corto, RENOVACION.
 *   En los dos casos los días se suman al vencimiento actual.
 * La prueba se pide y se completa por su propio camino (etapa 6).
 */
export function tipoDeOrden(
  licencia: { estado: EstadoLicencia; rangoPlan: number | null },
  planNuevo: { code: CodigoPlan; rank: number; isPublic: boolean },
): ResultadoTipoOrden {
  if (planNuevo.code === CODIGO_PLAN.PRUEBA || !planNuevo.isPublic) {
    return { error: 'PLAN_NO_DISPONIBLE' };
  }
  switch (licencia.estado) {
    case ESTADO_LICENCIA.PENDIENTE_PAGO:
    case ESTADO_LICENCIA.VENCIDA:
      return { tipo: TIPO_ORDEN.NUEVA };
    case ESTADO_LICENCIA.ACTIVA:
    case ESTADO_LICENCIA.EN_GRACIA:
      return {
        tipo:
          licencia.rangoPlan !== null && planNuevo.rank > licencia.rangoPlan
            ? TIPO_ORDEN.CAMBIO_DE_PLAN
            : TIPO_ORDEN.RENOVACION,
      };
    case ESTADO_LICENCIA.PRUEBA:
      return { error: 'LICENCIA_EN_PRUEBA' };
    case ESTADO_LICENCIA.SUSPENDIDA:
      return { error: 'LICENCIA_SUSPENDIDA' };
  }
}

/**
 * Hasta cuándo quedaría la licencia si se aprueba una orden. En una licencia nueva la fecha depende del día en que
 * se apruebe el pago, así que se devuelve `null`; en una renovación o un cambio de plan los días se suman al
 * vencimiento actual (también en la gracia: esos días cuentan como usados).
 */
export function vencimientoSiSeAprueba(
  tipo: TipoOrden,
  licencia: { finActual: Date | null },
  plan: DuracionPlan,
): Date | null {
  if (
    (tipo === TIPO_ORDEN.RENOVACION || tipo === TIPO_ORDEN.CAMBIO_DE_PLAN) &&
    licencia.finActual
  ) {
    return finDePeriodo(licencia.finActual, plan);
  }
  return null;
}

/** Cómo se pinta cada día en el calendario de triángulos del panel. */
export type DiaCalendario = 'usado' | 'hoy' | 'restante' | 'obsequio' | 'hoy-obsequio';

export interface FilaCalendario {
  /** Mes (0 a 11) del primer día de la fila, para su rótulo. */
  mes: number;
  dias: DiaCalendario[];
}

const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "2026-10-15": el día de calendario en Colombia, comparable como texto. */
function dia(fecha: Date): string {
  return formatoDia.format(fecha);
}

/**
 * El calendario de una licencia (propuesta 2): una fila por mes contado desde el inicio, con un triángulo por
 * día. Los días antes de hoy están usados; los del mes de obsequio se marcan aparte.
 */
export function calendarioLicencia(
  inicio: Date,
  fin: Date,
  ahora: Date,
  obsequios: { desde: Date; hasta: Date }[] = [],
): FilaCalendario[] {
  const hoy = dia(ahora);
  const rangos = obsequios.map((o) => ({ desde: dia(o.desde), hasta: dia(o.hasta) }));
  const filas: FilaCalendario[] = [];
  for (let m = 0; filas.length < 120; m++) {
    const desde = sumarMeses(inicio, m);
    if (desde >= fin) break;
    const siguiente = sumarMeses(inicio, m + 1);
    const hasta = siguiente < fin ? siguiente : fin;
    const total = diasEntre(desde, hasta);
    const dias: DiaCalendario[] = [];
    for (let d = 0; d < total; d++) {
      const esteDia = dia(sumarDias(desde, d));
      const obsequio = rangos.some((r) => esteDia >= r.desde && esteDia < r.hasta);
      if (esteDia < hoy) dias.push('usado');
      else if (esteDia === hoy) dias.push(obsequio ? 'hoy-obsequio' : 'hoy');
      else dias.push(obsequio ? 'obsequio' : 'restante');
    }
    filas.push({ mes: Number(dia(desde).slice(5, 7)) - 1, dias });
  }
  return filas;
}

/** Filtros de la lista de licencias del admin, en el orden en que se muestran. */
export const FILTROS_LICENCIAS = [
  'todas',
  'activas',
  'vence',
  'gracia',
  'vencidas',
  'pendientes',
  'prueba',
  'suspendidas',
] as const;
export type FiltroLicencias = (typeof FILTROS_LICENCIAS)[number];

export const NOMBRE_FILTRO_LICENCIAS: Record<FiltroLicencias, string> = {
  todas: 'Todas',
  activas: 'Activas',
  vence: `Vence en ${DIAS_VENCE_PRONTO} días`,
  gracia: 'En gracia',
  vencidas: 'Vencidas',
  pendientes: 'Pendientes de pago',
  prueba: 'En prueba',
  suspendidas: 'Suspendidas',
};

/** Límites de lo que un admin puede ajustar a mano en una licencia. */
export const LIMITES_ADMIN = {
  diasExtension: { minimo: 1, maximo: 90 },
  motivo: { minimo: 5, maximo: 300 },
  capitalUsd: { minimo: 1, maximo: 10_000_000 },
  notas: 2_000,
} as const;
