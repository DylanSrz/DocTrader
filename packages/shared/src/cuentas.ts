import type { Red } from './dominio.js';

/** Largos permitidos en los datos de una cuenta de trading (los mismos en la web y en la API). */
export const LIMITES_CUENTA = {
  titular: { minimo: 3, maximo: 120 },
  broker: { minimo: 2, maximo: 80 },
  servidor: { minimo: 3, maximo: 80 },
  numero: { minimo: 4, maximo: 16 },
  contrasena: { minimo: 4, maximo: 64 },
  /** Cuentas que puede tener un cliente al mismo tiempo. */
  maximoPorCliente: 20,
} as const;

/** El número de cuenta de MetaTrader son solo dígitos. */
export const PATRON_NUMERO_CUENTA = /^\d{4,16}$/;

/** Quita espacios al inicio y al final y junta los espacios repetidos: así se guarda lo que escribe el cliente. */
export function limpiarTexto(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}

/**
 * Forma normalizada para comparar cuentas: minúsculas, sin espacios ni guiones (`docs/CONTEXTO.md`, "Control de
 * la prueba"). "Just Markets-Live" y "justmarketslive" son el mismo servidor.
 */
export function normalizarParaComparar(texto: string): string {
  return texto
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_]+/g, '');
}

/** Lo que identifica una cuenta de trading: broker, servidor y número normalizados. */
export function claveDeCuenta(broker: string, servidor: string, numero: string): string {
  return [broker, servidor, numero].map(normalizarParaComparar).join('|');
}

/** Un hash de transacción de Tron o de Bitcoin: 64 caracteres hexadecimales. */
export function normalizarHash(hash: string): string | null {
  const limpio = hash.trim().toLowerCase().replace(/^0x/, '');
  return /^[0-9a-f]{64}$/.test(limpio) ? limpio : null;
}

/** Enlace para ver una transacción en el explorador público de su red. */
export function enlaceExplorador(red: Red, hash: string): string {
  return red === 'TRON'
    ? `https://tronscan.org/#/transaction/${hash}`
    : `https://mempool.space/tx/${hash}`;
}

/** Nombre de cada red como lo ve el cliente. */
export const NOMBRE_RED: Record<Red, string> = { TRON: 'Tron (TRC20)', BITCOIN: 'Bitcoin' };
