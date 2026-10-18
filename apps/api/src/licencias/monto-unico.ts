import { randomInt } from 'node:crypto';
import type { Red } from '@doctrader/shared';
import type { EntityManager } from 'typeorm';

/**
 * Cuánto se descuenta en Bitcoin, en satoshis, para que cada orden abierta tenga un monto distinto (de 1 a 999
 * satoshis, menos de un dólar). Siempre se descuenta: el cliente nunca paga más que el precio.
 */
export const RANGO_DESCUENTO_BTC = { minimo: 1, maximo: 999 } as const;

/**
 * El monto de una orden nueva, en unidades base.
 *
 * - **USDT (Tron):** el precio exacto (USD 125 → 125 USDT), sin centavos de diferencia: el cliente envía la cifra
 *   que ve en los precios. Como dos órdenes pueden pedir el mismo monto, la verificación marca "por confirmar" el pago
 *   que otro cliente también pudo enviar (`pagos/verificacion-pagos.service.ts`, `docs/SEGURIDAD.md` §6).
 * - **BTC:** el monto ya sale de la cotización y nunca es redondo; se le descuentan de 1 a 999 satoshis para que sea
 *   distinto del de las demás órdenes abiertas, con un candado por red para que dos órdenes al mismo tiempo no elijan
 *   el mismo.
 */
export async function montoDeOrden(m: EntityManager, red: Red, unidades: bigint): Promise<bigint> {
  if (red === 'TRON') return unidades;
  await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`monto-orden:${red}`]);
  const filas = (await m.query(
    `SELECT amount_base_units FROM payment_orders
      WHERE network = $1 AND status IN ('PENDIENTE', 'REPORTADA')`,
    [red],
  )) as { amount_base_units: string }[];
  const usados = new Set(filas.map((f) => f.amount_base_units));
  const libres: bigint[] = [];
  for (let n = RANGO_DESCUENTO_BTC.minimo; n <= RANGO_DESCUENTO_BTC.maximo; n++) {
    const candidato = unidades - BigInt(n);
    if (!usados.has(candidato.toString())) libres.push(candidato);
  }
  if (libres.length === 0) {
    throw new Error(`No hay montos libres en ${red}: demasiadas órdenes abiertas a la vez`);
  }
  return libres[randomInt(libres.length)]!;
}
