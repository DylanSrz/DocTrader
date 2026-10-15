import { base58Decodificar } from './tron.js';
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

// ── Direcciones ───────────────────────────────────────────────────────────────────────────────────────

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERADOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polimod(valores: number[]): number {
  let chk = 1;
  for (const v of valores) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= GENERADOR[i]!;
  }
  return chk >>> 0;
}

/** Decodifica una dirección segwit (BIP 173 y BIP 350): versión y programa, o `null` si no es válida. */
function segwit(direccion: string): { version: number; programa: number[] } | null {
  if (direccion !== direccion.toLowerCase() && direccion !== direccion.toUpperCase()) return null;
  const texto = direccion.toLowerCase();
  const separador = texto.lastIndexOf('1');
  if (texto.slice(0, separador) !== 'bc' || texto.length > 90) return null;
  const datos: number[] = [];
  for (const letra of texto.slice(separador + 1)) {
    const valor = BECH32.indexOf(letra);
    if (valor < 0) return null;
    datos.push(valor);
  }
  if (datos.length < 7) return null;
  const prefijo = [...'bc'].map((c) => c.charCodeAt(0) >> 5);
  const sufijo = [...'bc'].map((c) => c.charCodeAt(0) & 31);
  const suma = polimod([...prefijo, 0, ...sufijo, ...datos]);
  const version = datos[0]!;
  // v0 usa bech32 (constante 1); v1 en adelante, bech32m.
  if (suma !== (version === 0 ? 1 : 0x2bc830a3)) return null;
  // De grupos de 5 bits a bytes.
  let acumulado = 0;
  let bits = 0;
  const programa: number[] = [];
  for (const v of datos.slice(1, -6)) {
    acumulado = (acumulado << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      programa.push((acumulado >> bits) & 0xff);
    }
  }
  if (bits >= 5 || (acumulado & ((1 << bits) - 1)) !== 0) return null;
  if (version > 16 || programa.length < 2 || programa.length > 40) return null;
  if (version === 0 && programa.length !== 20 && programa.length !== 32) return null;
  return { version, programa };
}

/**
 * Valida una dirección de Bitcoin de la red principal con su checksum: las que empiezan por 1 o 3 (Base58Check) y
 * las segwit que empiezan por bc1 (bech32 y bech32m, incluida taproot).
 */
export function direccionBitcoinValida(direccion: string): boolean {
  if (/^[13]/.test(direccion)) {
    const datos = base58Decodificar(direccion);
    return datos !== null && datos.length === 21 && (datos[0] === 0x00 || datos[0] === 0x05);
  }
  return segwit(direccion) !== null;
}
