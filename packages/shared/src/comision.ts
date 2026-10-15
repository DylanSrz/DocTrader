/**
 * Comisión del socio (`docs/CONTEXTO.md`): un porcentaje de las ventas brutas aprobadas, liquidado por quincenas en
 * hora de Colombia: del 1 al 15 y del 16 al último día del mes. Colombia no cambia de hora, así que un día de
 * Bogotá empieza siempre a las 05:00 UTC.
 */

const DESFASE_BOGOTA_MS = 5 * 60 * 60_000;
const DIA_MS = 24 * 60 * 60_000;

/** El porcentaje se guarda en puntos básicos (10 % = 1000). Hasta 50 %, como en el diseño. */
export const LIMITES_COMISION = { minimoBp: 0, maximoBp: 5_000 } as const;

export interface PeriodoComision {
  /** Primer día, `AAAA-MM-DD` en hora de Colombia. */
  inicio: string;
  /** Último día, incluido. */
  fin: string;
  /** Instantes exactos: desde el inicio del primer día hasta el inicio del día siguiente al último (excluido). */
  desde: Date;
  hasta: Date;
}

function diaBogota(fecha: Date): { anio: number; mes: number; dia: number } {
  const local = new Date(fecha.getTime() - DESFASE_BOGOTA_MS);
  return { anio: local.getUTCFullYear(), mes: local.getUTCMonth(), dia: local.getUTCDate() };
}

function inicioDelDia(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes, dia) + DESFASE_BOGOTA_MS);
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const texto = (anio: number, mes: number, dia: number) =>
  `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(dia)}`;

/** La quincena a la que pertenece un instante (en hora de Colombia). */
export function periodoDeComision(fecha: Date): PeriodoComision {
  const { anio, mes, dia } = diaBogota(fecha);
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const [primero, final] = dia <= 15 ? [1, 15] : [16, ultimo];
  return {
    inicio: texto(anio, mes, primero),
    fin: texto(anio, mes, final),
    desde: inicioDelDia(anio, mes, primero),
    hasta: inicioDelDia(anio, mes, final + 1),
  };
}

/** La quincena siguiente. */
export function periodoSiguiente(periodo: PeriodoComision): PeriodoComision {
  return periodoDeComision(new Date(periodo.hasta.getTime() + DIA_MS / 2));
}

/** Las quincenas ya terminadas desde la que contiene `desde` hasta antes de la que contiene `ahora`. */
export function periodosCerrados(desde: Date, ahora: Date): PeriodoComision[] {
  const actual = periodoDeComision(ahora);
  const lista: PeriodoComision[] = [];
  for (let p = periodoDeComision(desde); p.desde < actual.desde; p = periodoSiguiente(p)) {
    lista.push(p);
  }
  return lista;
}

/** "10 %", "12,5 %": el porcentaje de unos puntos básicos, con formato colombiano. */
export function formatearPorcentaje(puntosBasicos: number): string {
  const valor = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(
    puntosBasicos / 100,
  );
  return `${valor} %`;
}
