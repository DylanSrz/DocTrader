import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 8 (socio, `docs/MODELO-DATOS.md` §3.7):
 * - `commission_rate_changes`: cada cambio del porcentaje. El primero (sin `old_bp`) es el porcentaje inicial.
 * - `commission_payouts`: una fila por quincena cerrada (1 al 15, 16 al último día, en hora de Colombia), con las
 *   ventas brutas y la comisión de las órdenes aprobadas en ella. Las órdenes quedan ligadas a su liquidación por
 *   `payment_orders.commission_payout_id`, así una venta nunca cuenta dos veces.
 */
export class Socio1792900000000 implements MigrationInterface {
  name = 'Socio1792900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE commission_rate_changes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        partner_id uuid NOT NULL REFERENCES partner_profiles (id),
        old_bp integer CHECK (old_bp BETWEEN 0 AND 10000),
        new_bp integer NOT NULL CHECK (new_bp BETWEEN 0 AND 10000),
        changed_by uuid REFERENCES users (id),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX commission_rate_changes_socio ON commission_rate_changes (partner_id, created_at DESC)`,
    );
    await q.query(`
      INSERT INTO commission_rate_changes (partner_id, new_bp, created_at)
      SELECT id, commission_bp, created_at FROM partner_profiles
    `);

    await q.query(`
      CREATE TABLE commission_payouts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        partner_id uuid NOT NULL REFERENCES partner_profiles (id),
        period_start date NOT NULL,
        period_end date NOT NULL,
        sales_count integer NOT NULL DEFAULT 0 CHECK (sales_count >= 0),
        gross_usd_cents bigint NOT NULL DEFAULT 0 CHECK (gross_usd_cents >= 0),
        commission_usd_cents bigint NOT NULL DEFAULT 0 CHECK (commission_usd_cents >= 0),
        status varchar(8) NOT NULL DEFAULT 'CERRADA' CHECK (status IN ('CERRADA', 'PAGADA')),
        paid_at timestamptz,
        paid_by uuid REFERENCES users (id),
        payment_reference text CHECK (length(payment_reference) <= 200),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (partner_id, period_start),
        CHECK (period_end >= period_start),
        CHECK ((status = 'PAGADA') = (paid_at IS NOT NULL))
      )
    `);
    await q.query(`
      ALTER TABLE payment_orders
        ADD CONSTRAINT payment_orders_commission_payout_id_fkey
        FOREIGN KEY (commission_payout_id) REFERENCES commission_payouts (id)
    `);
    await q.query(`
      CREATE INDEX payment_orders_sin_liquidar ON payment_orders (decided_at)
        WHERE status = 'APROBADA' AND commission_payout_id IS NULL
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX payment_orders_sin_liquidar`);
    await q.query(
      `ALTER TABLE payment_orders DROP CONSTRAINT payment_orders_commission_payout_id_fkey`,
    );
    await q.query(`DROP TABLE commission_payouts`);
    await q.query(`DROP TABLE commission_rate_changes`);
  }
}
