import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 11, programa de referidos (`docs/MODELO-DATOS.md` §3.8):
 * - `referral_profiles`: el código y la dirección de cobro (USDT, Tron) de quien refiere. Refieren los clientes con
 *   licencia activa, quienes un admin habilite (`enabled_by_admin`) y el socio (con su cuenta de admin).
 * - `users.referred_by`: quién invitó a cada cliente. Se fija al registrarse; solo un admin lo corrige.
 * - `payment_orders.referrer_id / referral_bp / referral_usd_cents`: la comisión de esa venta, fijada al aprobarla
 *   (como `commission_bp` del socio). `referral_payout_id` la liga al pago que la liquidó: nunca cuenta dos veces.
 * - `referral_payouts`: una fila por referidor y quincena cerrada con el total a enviar y, al enviarlo, el hash.
 * - Ajustes: porcentaje (20 %), mínimo para pagar (USD 20) y si el programa está activo.
 */
export class Referidos1793200000000 implements MigrationInterface {
  name = 'Referidos1793200000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE referral_profiles (
        user_id uuid PRIMARY KEY REFERENCES users (id),
        code varchar(8) NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
        usdt_address text CHECK (usdt_address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'),
        address_changed_at timestamptz,
        enabled_by_admin boolean NOT NULL DEFAULT false,
        enabled_by uuid REFERENCES users (id),
        enabled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`
      ALTER TABLE users
        ADD COLUMN referred_by uuid REFERENCES users (id),
        ADD COLUMN referred_at timestamptz,
        ADD CONSTRAINT users_no_autorreferido CHECK (referred_by IS NULL OR referred_by <> id)
    `);
    await q.query(
      `CREATE INDEX users_referidos ON users (referred_by) WHERE referred_by IS NOT NULL`,
    );

    await q.query(`
      CREATE TABLE referral_payouts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        referrer_id uuid NOT NULL REFERENCES users (id),
        period_start date NOT NULL,
        period_end date NOT NULL,
        sales_count integer NOT NULL DEFAULT 0 CHECK (sales_count >= 0),
        gross_usd_cents bigint NOT NULL DEFAULT 0 CHECK (gross_usd_cents >= 0),
        commission_usd_cents bigint NOT NULL DEFAULT 0 CHECK (commission_usd_cents >= 0),
        usdt_address text NOT NULL,
        status varchar(8) NOT NULL DEFAULT 'CERRADA' CHECK (status IN ('CERRADA', 'PAGADA')),
        paid_at timestamptz,
        paid_by uuid REFERENCES users (id),
        tx_hash text CHECK (length(tx_hash) <= 200),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (referrer_id, period_start),
        CHECK (period_end >= period_start),
        CHECK ((status = 'PAGADA') = (paid_at IS NOT NULL))
      )
    `);
    await q.query(`
      ALTER TABLE payment_orders
        ADD COLUMN referrer_id uuid REFERENCES users (id),
        ADD COLUMN referral_bp integer CHECK (referral_bp BETWEEN 0 AND 10000),
        ADD COLUMN referral_usd_cents integer CHECK (referral_usd_cents >= 0),
        ADD COLUMN referral_payout_id uuid REFERENCES referral_payouts (id),
        ADD CONSTRAINT payment_orders_referido_completo
          CHECK ((referrer_id IS NULL) = (referral_bp IS NULL) AND (referral_bp IS NULL) = (referral_usd_cents IS NULL))
    `);
    await q.query(`
      CREATE INDEX payment_orders_referido_sin_liquidar ON payment_orders (referrer_id, decided_at)
        WHERE status = 'APROBADA' AND referrer_id IS NOT NULL AND referral_payout_id IS NULL
    `);

    await q.query(`
      INSERT INTO settings (key, value) VALUES
        ('referrals.percentage_bp', '2000'::jsonb),
        ('referrals.min_payout_usd_cents', '2000'::jsonb),
        ('referrals.enabled', 'true'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DELETE FROM settings WHERE key IN ('referrals.percentage_bp', 'referrals.min_payout_usd_cents', 'referrals.enabled')`,
    );
    await q.query(`DROP INDEX payment_orders_referido_sin_liquidar`);
    await q.query(`
      ALTER TABLE payment_orders
        DROP CONSTRAINT payment_orders_referido_completo,
        DROP COLUMN referral_payout_id,
        DROP COLUMN referral_usd_cents,
        DROP COLUMN referral_bp,
        DROP COLUMN referrer_id
    `);
    await q.query(`DROP TABLE referral_payouts`);
    await q.query(`DROP INDEX users_referidos`);
    await q.query(`
      ALTER TABLE users
        DROP CONSTRAINT users_no_autorreferido,
        DROP COLUMN referred_at,
        DROP COLUMN referred_by
    `);
    await q.query(`DROP TABLE referral_profiles`);
  }
}
