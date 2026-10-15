import { randomInt } from 'node:crypto';
import type { Red } from '@doctrader/shared';
import type { EntityManager } from 'typeorm';

/**
 * Cuánto se descuenta, en unidades base, para que cada orden abierta tenga un monto distinto: de 0,01 a 0,99 USDT, o
 * de 1 a 999 satoshis (menos de un dólar). Siempre se descuenta: el cliente nunca paga más que el precio.
 */
export const RANGO_DESCUENTO: Record<Red, { minimo: number; maximo: number; paso: bigint }> = {
  TRON: { minimo: 1, maximo: 99, paso: 10_000n },
  BITCOIN: { minimo: 1, maximo: 999, paso: 1n },
};

/**
 * El monto de una orden nueva, distinto del de todas las órdenes abiertas (pendientes o reportadas) de la misma red
 * (`docs/SEGURIDAD.md` §6). Todas las órdenes usan la misma dirección de depósito, y la verificación exige el monto
 * exacto: así nadie puede reportar como suyo el hash del pago de otro cliente. Corre dentro de la transacción de la
 * orden, con un candado por red para que dos órdenes al mismo tiempo no elijan el mismo monto.
 */
export async function montoUnico(m: EntityManager, red: Red, unidades: bigint): Promise<bigint> {
  await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`monto-orden:${red}`]);
  const filas = (await m.query(
    `SELECT amount_base_units FROM payment_orders
      WHERE network = $1 AND status IN ('PENDIENTE', 'REPORTADA')`,
    [red],
  )) as { amount_base_units: string }[];
  const usados = new Set(filas.map((f) => f.amount_base_units));
  const { minimo, maximo, paso } = RANGO_DESCUENTO[red];
  const libres: bigint[] = [];
  for (let n = minimo; n <= maximo; n++) {
    const candidato = unidades - BigInt(n) * paso;
    if (!usados.has(candidato.toString())) libres.push(candidato);
  }
  if (libres.length === 0) {
    throw new Error(`No hay montos libres en ${red}: demasiadas órdenes abiertas a la vez`);
  }
  return libres[randomInt(libres.length)]!;
}
