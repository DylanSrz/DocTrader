import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Referidos en dos niveles (Argemiro, 2026-10-22): 15 % por la primera línea (quienes yo invito) y 5 % por la segunda
 * (quienes ellos invitan).
 * - `referral_commissions`: una fila por orden, nivel y referidor. Reemplaza las columnas `referrer_id`,
 *   `referral_bp`, `referral_usd_cents` y `referral_payout_id` de `payment_orders`, que solo admitían un nivel. Las
 *   comisiones que ya había se copian como nivel 1.
 * - Ajustes: `referrals.percentage_bp` pasa de 20 % a 15 % (solo si nadie lo cambió) y `referrals.level2_bp` = 5 %.
 * - Términos (16.2) y política de datos (§8): versiones nuevas, si el texto vigente todavía tiene el párrafo de antes.
 */
const TERMINOS_ANTES = `16.2. **Comisión.** Cuando una persona se registra con el enlace o el código de un Referidor, cada licencia o renovación
que pague le deja al Referidor el porcentaje vigente publicado en la plataforma (hoy, el 20 % de lo pagado), mientras
siga siendo cliente. El porcentaje se fija al aprobar cada pago. Las compras aprobadas mientras la licencia del
Referidor esté vencida no generan comisión, salvo que DocTraderPRO lo haya habilitado.`;
const TERMINOS_AHORA = `16.2. **Comisión.** Quien se registra con el enlace o el código de un Referidor queda en su **primera línea**; quienes
esa persona invite quedan en su **segunda línea**. Cada licencia o renovación que pague alguien de la primera línea le
deja al Referidor el porcentaje vigente publicado en la plataforma para ella (hoy, el 15 % de lo pagado), y cada una que
pague alguien de la segunda línea, el porcentaje de la segunda línea (hoy, el 5 %), mientras sigan siendo clientes. No
hay comisiones por líneas más abajo. Los porcentajes se fijan al aprobar cada pago. Las compras aprobadas mientras la
licencia del Referidor esté vencida no le generan comisión, salvo que DocTraderPRO lo haya habilitado.`;
const DATOS_ANTES = `- **Quien invitó al Titular**, si se registró con un enlace o código de invitación: esa persona ve solo su nombre de
  pila, la inicial de su apellido, si tiene una licencia activa y el valor de la comisión que le dejó cada compra.
  Nunca ve su correo, su documento, su teléfono ni sus cuentas de trading.`;
const DATOS_AHORA = `- **Quien invitó al Titular y quien invitó a esa persona**, si se registró con un enlace o código de invitación: ven
  solo su nombre de pila, la inicial de su apellido, por quién llegó, si tiene una licencia activa y el valor de la
  comisión que les dejó cada compra. Nunca ven su correo, su documento, su teléfono ni sus cuentas de trading.`;

export class ReferidosDosNiveles1793400000000 implements MigrationInterface {
  name = 'ReferidosDosNiveles1793400000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE referral_commissions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        payment_order_id uuid NOT NULL REFERENCES payment_orders (id),
        referrer_id uuid NOT NULL REFERENCES users (id),
        level smallint NOT NULL CHECK (level IN (1, 2)),
        bp integer NOT NULL CHECK (bp BETWEEN 0 AND 10000),
        usd_cents integer NOT NULL CHECK (usd_cents >= 0),
        earned_at timestamptz NOT NULL,
        payout_id uuid REFERENCES referral_payouts (id),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (payment_order_id, level)
      )
    `);
    await q.query(`
      CREATE INDEX referral_commissions_sin_liquidar ON referral_commissions (referrer_id, earned_at)
        WHERE payout_id IS NULL
    `);
    await q.query(
      `CREATE INDEX referral_commissions_referidor ON referral_commissions (referrer_id)`,
    );
    await q.query(`
      INSERT INTO referral_commissions
             (payment_order_id, referrer_id, level, bp, usd_cents, earned_at, payout_id)
      SELECT id, referrer_id, 1, referral_bp, referral_usd_cents, decided_at, referral_payout_id
        FROM payment_orders
       WHERE referrer_id IS NOT NULL AND status = 'APROBADA'
    `);
    await q.query(`DROP INDEX payment_orders_referido_sin_liquidar`);
    await q.query(`
      ALTER TABLE payment_orders
        DROP CONSTRAINT payment_orders_referido_completo,
        DROP COLUMN referral_payout_id,
        DROP COLUMN referral_usd_cents,
        DROP COLUMN referral_bp,
        DROP COLUMN referrer_id
    `);

    await q.query(
      `UPDATE settings SET value = '1500'::jsonb, updated_at = now()
        WHERE key = 'referrals.percentage_bp' AND value = '2000'::jsonb`,
    );
    await q.query(
      `INSERT INTO settings (key, value) VALUES ('referrals.level2_bp', '500'::jsonb) ON CONFLICT (key) DO NOTHING`,
    );

    for (const [tipo, antes, ahora] of [
      ['TERMS', TERMINOS_ANTES, TERMINOS_AHORA],
      ['PRIVACY', DATOS_ANTES, DATOS_AHORA],
    ] as const) {
      const [vigente] = (await q.query(
        `SELECT version, content_md FROM legal_documents WHERE type = $1 ORDER BY version DESC LIMIT 1`,
        [tipo],
      )) as { version: number; content_md: string }[];
      if (!vigente?.content_md.includes(antes)) continue;
      await q.query(`INSERT INTO legal_documents (type, version, content_md) VALUES ($1, $2, $3)`, [
        tipo,
        vigente.version + 1,
        vigente.content_md.replace(antes, ahora),
      ]);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    // Las versiones de los textos legales son historia y se conservan. El nivel 2 se pierde: el esquema anterior no
    // lo admitía.
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
      UPDATE payment_orders o
         SET referrer_id = c.referrer_id, referral_bp = c.bp, referral_usd_cents = c.usd_cents,
             referral_payout_id = c.payout_id
        FROM referral_commissions c
       WHERE c.payment_order_id = o.id AND c.level = 1
    `);
    await q.query(`
      CREATE INDEX payment_orders_referido_sin_liquidar ON payment_orders (referrer_id, decided_at)
        WHERE status = 'APROBADA' AND referrer_id IS NOT NULL AND referral_payout_id IS NULL
    `);
    await q.query(`DROP TABLE referral_commissions`);
    await q.query(`DELETE FROM settings WHERE key = 'referrals.level2_bp'`);
    await q.query(
      `UPDATE settings SET value = '2000'::jsonb WHERE key = 'referrals.percentage_bp' AND value = '1500'::jsonb`,
    );
  }
}
