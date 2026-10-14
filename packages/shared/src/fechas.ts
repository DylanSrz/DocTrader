import { TZDate } from '@date-fns/tz';
import { addDays, addMonths } from 'date-fns';

/** Zona horaria del negocio: las fechas se muestran y las licencias se calculan en hora de Colombia. */
export const ZONA_HORARIA = 'America/Bogota';

/**
 * Suma meses de calendario en hora de Colombia. Del 3 de octubre, un mes llega al 3 de noviembre; si el día no
 * existe en el mes de llegada (31 de enero + 1 mes), se usa el último día de ese mes.
 */
export function sumarMeses(fecha: Date, meses: number): Date {
  return new Date(addMonths(new TZDate(fecha, ZONA_HORARIA), meses).getTime());
}

/** Suma días de calendario en hora de Colombia. */
export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(addDays(new TZDate(fecha, ZONA_HORARIA), dias).getTime());
}
