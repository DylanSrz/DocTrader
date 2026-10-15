import { createHash } from 'node:crypto';
import { ErrorProveedor, type Lectura } from './lectura.js';

/** USDT en Tron (TRC20), con 6 decimales (`docs/DECISIONES-TECNICAS.md` §2). */
export const CONTRATO_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
/** Firma del evento `Transfer(address,address,uint256)`. */
const EVENTO_TRANSFER = 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const ALFABETO = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function sha256(datos: Buffer): Buffer {
  return createHash('sha256').update(datos).digest();
}

/** Base58Check (el formato de las direcciones de Tron y de las de Bitcoin que empiezan por 1 o 3). */
export function base58Decodificar(texto: string): Buffer | null {
  let numero = 0n;
  for (const letra of texto) {
    const valor = ALFABETO.indexOf(letra);
    if (valor < 0) return null;
    numero = numero * 58n + BigInt(valor);
  }
  const hex = numero.toString(16);
  const cuerpo = Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex');
  const ceros = texto.length - texto.replace(/^1+/, '').length;
  const completo = Buffer.concat([Buffer.alloc(ceros), numero === 0n ? Buffer.alloc(0) : cuerpo]);
  if (completo.length < 5) return null;
  const datos = completo.subarray(0, -4);
  const suma = completo.subarray(-4);
  return sha256(sha256(datos)).subarray(0, 4).equals(suma) ? datos : null;
}

export function base58Codificar(datos: Buffer): string {
  const completo = Buffer.concat([datos, sha256(sha256(datos)).subarray(0, 4)]);
  let numero = BigInt(`0x${completo.toString('hex') || '0'}`);
  let texto = '';
  while (numero > 0n) {
    texto = ALFABETO[Number(numero % 58n)] + texto;
    numero /= 58n;
  }
  for (const byte of completo) {
    if (byte !== 0) break;
    texto = `1${texto}`;
  }
  return texto;
}

/** Una dirección de Tron válida: 21 bytes que empiezan por 0x41, con su checksum. */
export function direccionTronValida(direccion: string): boolean {
  const datos = base58Decodificar(direccion);
  return datos !== null && datos.length === 21 && datos[0] === 0x41;
}

/** 20 bytes en hexadecimal (como los dan los eventos) → dirección `T…`. */
export function tronDesdeHex(hex: string): string {
  return base58Codificar(Buffer.from(`41${hex.slice(-40)}`, 'hex'));
}

const USDT_HEX = base58Decodificar(CONTRATO_USDT)!.subarray(1).toString('hex');

interface RespuestaTronGrid {
  id?: string;
  blockNumber?: number;
  blockTimeStamp?: number;
  receipt?: { result?: string };
  log?: { address: string; topics: string[]; data: string }[];
}

/** `wallet/gettransactioninfobyid` de TronGrid más la altura actual (`wallet/getnowblock`). */
export function leerTronGrid(info: RespuestaTronGrid, bloqueActual: number): Lectura {
  if (!info || typeof info !== 'object') throw new ErrorProveedor('Respuesta vacía de TronGrid');
  if (!info.id) return { encontrada: false };
  const transferencias = (info.log ?? []).filter((l) => l.topics?.[0] === EVENTO_TRANSFER);
  const deUsdt = transferencias.filter((l) => l.address?.toLowerCase() === USDT_HEX);
  const bloque = info.blockNumber ?? null;
  return {
    encontrada: true,
    exitosa: info.receipt?.result === 'SUCCESS',
    hora: info.blockTimeStamp ? new Date(info.blockTimeStamp) : null,
    bloque,
    confirmaciones: bloque === null ? 0 : Math.max(0, bloqueActual - bloque + 1),
    pagos: deUsdt.map((l) => ({
      direccion: tronDesdeHex(l.topics[2]!),
      unidades: BigInt(`0x${l.data || '0'}`),
    })),
    otraMoneda: transferencias.length > deUsdt.length,
    remitentes: [...new Set(deUsdt.map((l) => tronDesdeHex(l.topics[1]!)))],
  };
}

interface RespuestaTronscan {
  hash?: string;
  block?: number;
  timestamp?: number;
  confirmations?: number;
  contractRet?: string;
  revert?: boolean;
  trc20TransferInfo?: {
    contract_address: string;
    from_address: string;
    to_address: string;
    amount_str: string;
  }[];
}

/** `api/transaction-info` de Tronscan (proveedor de respaldo). */
export function leerTronscan(info: RespuestaTronscan): Lectura {
  if (!info || typeof info !== 'object') throw new ErrorProveedor('Respuesta vacía de Tronscan');
  if (!info.hash) return { encontrada: false };
  const transferencias = info.trc20TransferInfo ?? [];
  const deUsdt = transferencias.filter((t) => t.contract_address === CONTRATO_USDT);
  return {
    encontrada: true,
    exitosa: info.contractRet === 'SUCCESS' && !info.revert,
    hora: info.timestamp ? new Date(info.timestamp) : null,
    bloque: info.block ?? null,
    confirmaciones: Math.max(0, info.confirmations ?? 0),
    pagos: deUsdt.map((t) => ({ direccion: t.to_address, unidades: BigInt(t.amount_str) })),
    otraMoneda: transferencias.length > deUsdt.length,
    remitentes: [...new Set(deUsdt.map((t) => t.from_address))],
  };
}
