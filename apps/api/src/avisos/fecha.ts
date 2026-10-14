import { ZONA_HORARIA } from '@doctrader/shared';

const formato = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: ZONA_HORARIA,
});

/** Fecha y hora de Colombia para los correos: "14 de octubre de 2026, 5:40 p. m.". */
export function fechaLegible(fecha: Date = new Date()): string {
  return formato.format(fecha);
}
