/**
 * Elegir el precio de BTC con dos proveedores (`docs/DECISIONES-TECNICAS.md` §2): Binance es el principal y
 * CoinGecko el de respaldo. Si responden los dos y difieren en más de 1 %, no se fija ningún precio.
 */

/** Diferencia máxima entre proveedores, en puntos básicos (1 % = 100). */
export const DIFERENCIA_MAXIMA_BP = 100n;

export type Cotizacion =
  | { ok: true; centavos: bigint; fuente: 'BINANCE' | 'COINGECKO' }
  | { ok: false; motivo: 'SIN_PROVEEDORES' }
  | { ok: false; motivo: 'NO_COINCIDEN'; binance: bigint; coingecko: bigint };

/** Convierte "67234.12000000" o 67234.1 en centavos de dólar, sin pasar por números con decimales. */
export function aCentavos(valor: string | number): bigint | null {
  const texto = typeof valor === 'number' ? valor.toFixed(2) : valor.trim();
  const coincide = /^(\d+)(?:\.(\d+))?$/.exec(texto);
  if (!coincide) return null;
  const [, entero = '0', fraccion = ''] = coincide;
  // Se redondea al centavo con el tercer decimal.
  const centavos = BigInt(entero) * 100n + BigInt((fraccion + '00').slice(0, 2));
  const redondeo = Number((fraccion + '000')[2]) >= 5 ? 1n : 0n;
  const total = centavos + redondeo;
  return total > 0n ? total : null;
}

export function elegirPrecio(binance: bigint | null, coingecko: bigint | null): Cotizacion {
  if (binance && coingecko) {
    const mayor = binance > coingecko ? binance : coingecko;
    const menor = binance > coingecko ? coingecko : binance;
    if ((mayor - menor) * 10_000n > menor * DIFERENCIA_MAXIMA_BP) {
      return { ok: false, motivo: 'NO_COINCIDEN', binance, coingecko };
    }
    return { ok: true, centavos: binance, fuente: 'BINANCE' };
  }
  if (binance) return { ok: true, centavos: binance, fuente: 'BINANCE' };
  if (coingecko) return { ok: true, centavos: coingecko, fuente: 'COINGECKO' };
  return { ok: false, motivo: 'SIN_PROVEEDORES' };
}

/**
 * Satoshis que hay que enviar para cubrir un monto en dólares a un precio dado. Se redondea hacia arriba: el
 * cliente nunca queda debiendo un satoshi.
 */
export function satoshisPara(centavosUsd: number, centavosPorBtc: bigint): bigint {
  const numerador = BigInt(centavosUsd) * 100_000_000n;
  return (numerador + centavosPorBtc - 1n) / centavosPorBtc;
}

/** Centavos de dólar a texto con dos decimales ("67234.12"), para guardarlo en `btc_usd_rate`. */
export function centavosATexto(centavos: bigint): string {
  const texto = centavos.toString().padStart(3, '0');
  return `${texto.slice(0, -2)}.${texto.slice(-2)}`;
}
