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
 * Forma normalizada para comparar cuentas: minúsculas, sin espacios ni guiones. "Just Markets-Live" y
 * "justmarketslive" son el mismo servidor.
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

/**
 * Un pago entre dos cuentas de Binance no pasa por la blockchain: Binance lo mueve por dentro y en vez de hash da un
 * número ("Off-chain Transfer 421231346716"). Se guarda en `tx_hash` con este prefijo, así el índice único también
 * impide usarlo dos veces.
 */
export const PREFIJO_BINANCE = 'binance:';
/** Un pago que registró un admin a mano, sin código del cliente. */
export const PREFIJO_MANUAL = 'manual:';

/** El número de una transferencia interna de Binance, con o sin el texto "Off-chain Transfer" que muestra Binance. */
export function normalizarTransferenciaBinance(texto: string): string | null {
  const limpio = texto
    .trim()
    .replace(/^off[\s-]*chain[\s-]*transfer/i, '')
    .replace(/[\s#:]/g, '');
  return /^\d{6,20}$/.test(limpio) ? limpio : null;
}

/** Lo que el cliente pegó al reportar: el hash de la blockchain o el número de una transferencia interna de Binance. */
export function interpretarReferencia(texto: string): string | null {
  const hash = normalizarHash(texto);
  if (hash) return hash;
  const interna = normalizarTransferenciaBinance(texto);
  return interna ? `${PREFIJO_BINANCE}${interna}` : null;
}

export function esTransferenciaBinance(referencia: string): boolean {
  return referencia.startsWith(PREFIJO_BINANCE);
}

/** Cómo se muestra la referencia de un pago: el hash tal cual, o una frase para los que no tienen hash. */
export function describirReferencia(referencia: string): string {
  if (referencia.startsWith(PREFIJO_BINANCE)) {
    return `Transferencia interna de Binance ${referencia.slice(PREFIJO_BINANCE.length)}`;
  }
  if (referencia.startsWith(PREFIJO_MANUAL)) return 'Registrado a mano por un administrador';
  return referencia;
}

/** Enlace para ver una transacción en el explorador público de su red. Las transferencias internas no tienen. */
export function enlaceExplorador(red: Red, hash: string): string | null {
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  return red === 'TRON'
    ? `https://tronscan.org/#/transaction/${hash}`
    : `https://mempool.space/tx/${hash}`;
}

/** Nombre de cada red como lo ve el cliente. */
export const NOMBRE_RED: Record<Red, string> = { TRON: 'Tron (TRC20)', BITCOIN: 'Bitcoin' };
