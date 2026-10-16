import { aUnidadesBase, type Moneda, normalizarTransferenciaBinance } from '@doctrader/shared';
import { ErrorProveedor, type Lectura } from './lectura.js';

/**
 * Un depósito del historial de Binance (`GET /sapi/v1/capital/deposit/hisrec`). Las transferencias entre cuentas de
 * Binance llegan con `transferType` 1 y `txId` "Off-chain transfer <número>".
 */
export interface DepositoBinance {
  amount: string;
  coin: string;
  network?: string;
  status: number;
  address: string;
  txId: string;
  insertTime: number;
  transferType?: number;
}

/** Estados del depósito en Binance: 1 acreditado, 6 acreditado aún sin poder retirar, 0 en proceso. */
const ACREDITADO = new Set([1, 6]);
const EN_PROCESO = 0;

function unidades(monto: string, moneda: Moneda): bigint {
  // Binance escribe 8 decimales ("120.00000000"); USDT usa 6. Los ceros de más no cambian el monto.
  const sinCeros = monto
    .trim()
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
  try {
    return aUnidadesBase(sinCeros, moneda);
  } catch {
    throw new ErrorProveedor(`Binance devolvió un monto que no se entiende: "${monto}"`);
  }
}

/**
 * Busca la transferencia interna en el historial de depósitos de la cuenta de cobro y la traduce a la misma lectura
 * que la blockchain, para que la verificación haga los mismos chequeos (destino, moneda, monto y fecha). Una
 * transferencia interna es final: no tiene confirmaciones que esperar.
 */
export function leerDepositoBinance(
  depositos: DepositoBinance[],
  numero: string,
  moneda: Moneda,
): Lectura {
  const deposito = depositos.find((d) => normalizarTransferenciaBinance(d.txId) === numero);
  if (!deposito) return { encontrada: false };
  const mismaMoneda = deposito.coin.toUpperCase() === moneda;
  return {
    encontrada: true,
    exitosa: ACREDITADO.has(deposito.status) || deposito.status === EN_PROCESO,
    hora: new Date(deposito.insertTime),
    bloque: null,
    confirmaciones: ACREDITADO.has(deposito.status) ? Number.MAX_SAFE_INTEGER : 0,
    pagos: mismaMoneda
      ? [{ direccion: deposito.address, unidades: unidades(deposito.amount, moneda) }]
      : [],
    otraMoneda: !mismaMoneda,
    remitentes: [],
    interna: true,
  };
}
