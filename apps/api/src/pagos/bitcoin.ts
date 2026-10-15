import { ErrorProveedor, type Lectura } from './lectura.js';

/** Una transacción de la API de Esplora (mempool.space y Blockstream usan la misma). */
interface RespuestaEsplora {
  txid?: string;
  vin?: { prevout?: { scriptpubkey_address?: string } | null }[];
  vout?: { scriptpubkey_address?: string; value: number }[];
  status?: { confirmed: boolean; block_height?: number; block_time?: number };
}

/** `/api/tx/:txid` más la altura actual (`/api/blocks/tip/height`). `null` es "no existe" (la API responde 404). */
export function leerEsplora(tx: RespuestaEsplora | null, alturaActual: number): Lectura {
  if (tx === null) return { encontrada: false };
  if (!tx || typeof tx !== 'object' || !tx.txid || !tx.status) {
    throw new ErrorProveedor('Respuesta inesperada de la API de Bitcoin');
  }
  const confirmada = tx.status.confirmed && typeof tx.status.block_height === 'number';
  const porDireccion = new Map<string, bigint>();
  for (const salida of tx.vout ?? []) {
    if (!salida.scriptpubkey_address) continue;
    const anterior = porDireccion.get(salida.scriptpubkey_address) ?? 0n;
    porDireccion.set(salida.scriptpubkey_address, anterior + BigInt(salida.value));
  }
  return {
    encontrada: true,
    exitosa: true,
    hora: confirmada && tx.status.block_time ? new Date(tx.status.block_time * 1000) : null,
    bloque: confirmada ? tx.status.block_height! : null,
    confirmaciones: confirmada ? Math.max(0, alturaActual - tx.status.block_height! + 1) : 0,
    pagos: [...porDireccion].map(([direccion, unidades]) => ({ direccion, unidades })),
    otraMoneda: false,
    remitentes: [
      ...new Set(
        (tx.vin ?? [])
          .map((entrada) => entrada.prevout?.scriptpubkey_address)
          .filter((d): d is string => Boolean(d)),
      ),
    ],
  };
}
