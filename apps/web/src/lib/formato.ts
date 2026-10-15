import {
  type EstadoOrden,
  formatearUsd,
  type Moneda,
  NOMBRE_RED,
  type NivelRiesgo,
  type Red,
  type TipoOrden,
  ZONA_HORARIA,
} from '@doctrader/shared';

/** Formatos de fecha, dinero y nombres que ve el cliente, siempre en hora de Colombia. */

const corta = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: ZONA_HORARIA,
});
const cortaSinAnio = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: ZONA_HORARIA,
});
const larga = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: ZONA_HORARIA,
});
const anio = new Intl.DateTimeFormat('es-CO', { year: 'numeric', timeZone: ZONA_HORARIA });

/** "15 jul 2026" (sin el punto que Intl pone tras el mes). */
export function fechaCorta(fecha: string | Date): string {
  return corta.format(new Date(fecha)).replace('.', '').replaceAll(' de ', ' ');
}

/** "15 de enero de 2027". */
export function fechaLarga(fecha: string | Date): string {
  return larga.format(new Date(fecha));
}

/** "del 15 jul al 15 oct 2026", o con los dos años si cambia. */
export function rangoFechas(desde: string, hasta: string): string {
  const mismoAnio = anio.format(new Date(desde)) === anio.format(new Date(hasta));
  const inicio = mismoAnio
    ? cortaSinAnio.format(new Date(desde)).replace('.', '').replaceAll(' de ', ' ')
    : fechaCorta(desde);
  return `del ${inicio} al ${fechaCorta(hasta)}`;
}

export const usd = formatearUsd;

/** "319 USDT", "0.00397927 BTC". */
export function montoCripto(monto: string, moneda: Moneda): string {
  return `${monto} ${moneda}`;
}

export function nombreRed(red: Red): string {
  return NOMBRE_RED[red];
}

/** "Mensual, 1 mes", "Semestral, 6 meses" (o "+ 1 de obsequio" si el plan lo trae). */
export function describirPlan(plan: {
  nombre: string;
  meses: number | null;
  mesesObsequio: number;
  dias: number | null;
}): string {
  if (plan.meses === null) return `${plan.nombre}, ${plan.dias} días`;
  const meses = plan.meses === 1 ? '1 mes' : `${plan.meses} meses`;
  return plan.mesesObsequio > 0
    ? `${plan.nombre}, ${meses} + ${plan.mesesObsequio} de obsequio`
    : `${plan.nombre}, ${meses}`;
}

export const NOMBRE_TIPO_ORDEN: Record<TipoOrden, string> = {
  NUEVA: 'Licencia',
  RENOVACION: 'Renovación',
  CAMBIO_DE_PLAN: 'Cambio a',
  PRUEBA: 'Prueba',
  COMPLETAR_PRUEBA: 'Completar la prueba con',
};

/** "Licencia mensual", "Renovación mensual", "Cambio a semestral", "Prueba". */
export function conceptoOrden(tipo: TipoOrden, nombrePlan: string): string {
  if (tipo === 'PRUEBA') return 'Licencia de prueba';
  return `${NOMBRE_TIPO_ORDEN[tipo]} ${nombrePlan.toLowerCase()}`;
}

export const ESTADO_ORDEN_VISIBLE: Record<
  EstadoOrden,
  { texto: string; tono: 'senal' | 'llama' | 'neutro' | 'apagado' | 'error' }
> = {
  PENDIENTE: { texto: 'Pendiente', tono: 'neutro' },
  REPORTADA: { texto: 'En revisión', tono: 'llama' },
  APROBADA: { texto: 'Aprobado', tono: 'senal' },
  RECHAZADA: { texto: 'Rechazado', tono: 'error' },
  EXPIRADA: { texto: 'Expirada', tono: 'apagado' },
  CANCELADA: { texto: 'Cancelada', tono: 'apagado' },
};

export const NOMBRE_RIESGO: Record<NivelRiesgo, string> = {
  BAJO: 'Bajo',
  MEDIO: 'Medio',
  ALTO: 'Alto',
};

/** "5 días" / "1 día". */
export function dias(n: number): string {
  return n === 1 ? '1 día' : `${n} días`;
}
