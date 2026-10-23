import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import {
  limpiarParaLanzamiento,
  MARCA_LIMPIEZA,
  type ResultadoLimpieza,
} from '../src/database/limpieza-lanzamiento.js';
import { adminConSesion, clienteConSesion, datosCuenta } from './ayudas.js';
import { crearApp } from './crear-app.js';

let app: INestApplication;
let fuente: DataSource;

beforeAll(async () => {
  app = await crearApp();
  fuente = app.get(getDataSourceToken());
});

afterAll(async () => {
  await app.close();
});

/** Para deshacer la transacción de la prueba sin dejar nada borrado para las demás. */
class Deshacer extends Error {}

/** Corre `prueba` dentro de una transacción que siempre se deshace. */
async function sinDejarRastro(prueba: (m: EntityManager) => Promise<void>): Promise<void> {
  await expect(
    fuente.transaction(async (m) => {
      await prueba(m);
      throw new Deshacer();
    }),
  ).rejects.toBeInstanceOf(Deshacer);
}

const contar = async (m: EntityManager, desde: string, parametros: unknown[] = []) =>
  ((await m.query(`SELECT count(*)::int AS n FROM ${desde}`, parametros)) as { n: number }[])[0]!.n;

describe('limpieza para el lanzamiento', () => {
  it('borra los clientes con sus referidos, conserva a los admins y no se repite', async () => {
    const admin = await adminConSesion(app);
    const ana = await clienteConSesion(app, { nombre: 'Ana Limpieza' });
    // Ana refiere a Bruno y Bruno tiene una orden con su comisión, ya liquidada en una quincena cerrada.
    await fuente.query(
      `INSERT INTO referral_profiles (user_id, code, usdt_address)
       VALUES ($1, 'LMPZANA2', 'TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x')`,
      [ana.usuario.id],
    );
    const bruno = await clienteConSesion(app, { nombre: 'Bruno Limpieza' });
    await fuente.query(`UPDATE users SET referred_by = $1, referred_at = now() WHERE id = $2`, [
      ana.usuario.id,
      bruno.usuario.id,
    ]);
    const cuenta = await bruno.web.post('/cuentas', datosCuenta()).expect(201);
    const orden = await bruno.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    const [pago] = (await fuente.query(
      `INSERT INTO referral_payouts (referrer_id, period_start, period_end, usdt_address)
       VALUES ($1, '2025-03-01', '2025-03-15', 'TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x') RETURNING id`,
      [ana.usuario.id],
    )) as { id: string }[];
    await fuente.query(
      `INSERT INTO referral_commissions (payment_order_id, referrer_id, level, bp, usd_cents, earned_at, payout_id)
       SELECT id, $2, 1, 1500, 1800, now(), $3 FROM payment_orders WHERE number = $1`,
      [orden.body.numero, ana.usuario.id, pago!.id],
    );
    // El perfil de un admin (como el del socio) se queda.
    await fuente.query(
      `INSERT INTO referral_profiles (user_id, code) VALUES ($1, 'LMPZADM2') ON CONFLICT DO NOTHING`,
      [admin.usuario.id],
    );

    await sinDejarRastro(async (m) => {
      // Sin confirmar solo cuenta.
      const simulacro: ResultadoLimpieza = await limpiarParaLanzamiento(m, false);
      expect(simulacro.borrado.referral_commissions).toBeGreaterThanOrEqual(1);
      expect(simulacro.borrado.referral_payouts).toBeGreaterThanOrEqual(1);
      expect(await contar(m, `users WHERE id = $1`, [bruno.usuario.id])).toBe(1);

      const admins = await contar(m, `users WHERE role = 'ADMIN'`);
      const { borrado, quedan } = await limpiarParaLanzamiento(m, true);
      expect(borrado.users).toBe(simulacro.borrado.users);
      expect(quedan).toEqual({ ADMIN: admins });
      for (const tabla of [
        'payment_orders',
        'referral_commissions',
        'referral_payouts',
        'licenses',
        'trading_accounts',
      ]) {
        expect(await contar(m, tabla)).toBe(0);
      }
      expect(await contar(m, `referral_profiles WHERE code = 'LMPZADM2'`)).toBe(1);
      expect(await contar(m, `settings WHERE key = $1`, [MARCA_LIMPIEZA])).toBe(1);

      // Una segunda corrida confirmada se niega; sin confirmar, sigue contando.
      await expect(limpiarParaLanzamiento(m, true)).rejects.toThrow('ya se limpió');
      expect((await limpiarParaLanzamiento(m, false)).borrado.users).toBe(0);
    });

    // Todo se deshizo: los clientes siguen ahí para las demás pruebas.
    expect(await contar(fuente.manager, `users WHERE id = $1`, [bruno.usuario.id])).toBe(1);
    expect(await contar(fuente.manager, `settings WHERE key = $1`, [MARCA_LIMPIEZA])).toBe(0);
  });
});
