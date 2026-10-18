// @ts-expect-error: `pg` no trae tipos y solo se usa aquí, para una consulta.
import pg from 'pg';
import { afterAll, beforeAll, beforeEach } from 'vitest';

/**
 * En USDT todas las órdenes del mismo plan piden el precio exacto, así que una orden pendiente que dejó otra prueba
 * (de este archivo o de otro) haría que un pago quede "por confirmar" (`POR_CONFIRMAR`), que es lo que debe pasar en
 * producción. Para que cada prueba sea independiente, empieza sin órdenes ajenas que puedan reclamar su pago: las
 * pendientes se cancelan y las vencidas sin pago se corren dos días al pasado.
 */
const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });

beforeAll(async () => {
  await cliente.connect();
});

beforeEach(async () => {
  await cliente.query(`UPDATE payment_orders SET status = 'CANCELADA' WHERE status = 'PENDIENTE'`);
  await cliente.query(
    `UPDATE payment_orders
        SET created_at = created_at - interval '2 days', expires_at = expires_at - interval '2 days'
      WHERE status = 'EXPIRADA' AND tx_hash IS NULL AND expires_at > now() - interval '1 day'`,
  );
});

afterAll(async () => {
  await cliente.end();
});
