import { fechaCorta, fechaLarga } from './formato';

/** Lo que devuelve `GET /admin/socio`. */
export interface VistaSocio {
  socio: {
    nombre: string;
    porcentajeBp: number;
    /** Solo el socio cambia su porcentaje. */
    esElSocio: boolean;
  } | null;
  actual?: {
    inicio: string;
    fin: string;
    ventas: number;
    brutoUsdCents: number;
    comisionUsdCents: number;
  };
  porPagarUsdCents?: number;
  liquidaciones?: Liquidacion[];
  cambios?: { fecha: string; anteriorBp: number | null; nuevoBp: number; quien: string | null }[];
}

export interface Liquidacion {
  id: string;
  inicio: string;
  fin: string;
  ventas: number;
  brutoUsdCents: number;
  comisionUsdCents: number;
  estado: 'CERRADA' | 'PAGADA';
  pagadaEn: string | null;
  pagadaPor: string | null;
  referencia: string | null;
}

/** Un día `AAAA-MM-DD` de Colombia como fecha (al mediodía, para que ninguna zona horaria lo cambie de día). */
const dia = (texto: string) => new Date(`${texto}T12:00:00-05:00`);

/** "1 al 15 oct 2026" o, si cambia de mes, "16 sep al 1 oct 2026". */
export function nombrePeriodo(inicio: string, fin: string): string {
  const [a, b] = [fechaCorta(dia(inicio)), fechaCorta(dia(fin))];
  const [diaA, ...restoA] = a.split(' ');
  const [, ...restoB] = b.split(' ');
  return restoA.join(' ') === restoB.join(' ') ? `${diaA} al ${b}` : `${a} al ${b}`;
}

/** "15 de octubre" (sin el año), para el titular. */
export function diaYMes(texto: string): string {
  return fechaLarga(dia(texto)).replace(/ de \d{4}$/, '');
}
