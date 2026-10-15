import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 6 (licencia de prueba, `docs/MODELO-DATOS.md` §3.5):
 * - `trial_requests`: las solicitudes, con lo que las bloqueó o las señales que encontraron.
 * - `trial_registry`: las huellas (HMAC con `TRIAL_HMAC_KEY`) de cada prueba aprobada. No tienen llave foránea a la
 *   solicitud a propósito: sobreviven al borrado del cliente, para que la regla de una prueba no se salte borrando
 *   la cuenta.
 */
export class LicenciaDePrueba1792600000000 implements MigrationInterface {
  name = 'LicenciaDePrueba1792600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE trial_requests (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL REFERENCES users (id),
        trading_account_id uuid NOT NULL REFERENCES trading_accounts (id),
        status varchar(16) NOT NULL CHECK (status IN ('BLOQUEADA', 'PENDIENTE', 'APROBADA', 'RECHAZADA')),
        block_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
        signals jsonb NOT NULL DEFAULT '[]'::jsonb,
        device_hash bytea,
        ip text,
        decided_by uuid REFERENCES users (id),
        decided_at timestamptz,
        decision_note text CHECK (decision_note IS NULL OR length(decision_note) <= 500),
        payment_order_id uuid REFERENCES payment_orders (id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((status = 'BLOQUEADA') = (jsonb_array_length(block_reasons) > 0))
      )
    `);
    // Una persona tiene a lo sumo una solicitud en revisión o aprobada: la prueba es una sola vez.
    await q.query(`
      CREATE UNIQUE INDEX trial_requests_una_vigente
        ON trial_requests (user_id) WHERE status IN ('PENDIENTE', 'APROBADA')
    `);
    await q.query(`CREATE INDEX trial_requests_estado ON trial_requests (status, created_at)`);
    await q.query(`CREATE INDEX trial_requests_cuenta ON trial_requests (trading_account_id)`);

    await q.query(`
      CREATE TABLE trial_registry (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        kind varchar(16) NOT NULL CHECK (kind IN
          ('CEDULA', 'CUENTA', 'CORREO', 'TELEFONO', 'NUMERO_CUENTA', 'DISPOSITIVO', 'BILLETERA')),
        fingerprint bytea NOT NULL,
        key_version smallint NOT NULL DEFAULT 1,
        trial_request_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (kind, fingerprint, trial_request_id)
      )
    `);
    await q.query(`CREATE INDEX trial_registry_huella ON trial_registry (kind, fingerprint)`);
    // Las huellas no se cambian: solo se agregan (se borran a mano, con la base de datos, si la ley lo pide).
    await q.query(`
      CREATE FUNCTION trial_registry_solo_agregar() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'trial_registry no se modifica';
      END
      $$ LANGUAGE plpgsql
    `);
    await q.query(`
      CREATE TRIGGER trial_registry_inmutable BEFORE UPDATE ON trial_registry
        FOR EACH ROW EXECUTE FUNCTION trial_registry_solo_agregar()
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE trial_registry`);
    await q.query(`DROP FUNCTION trial_registry_solo_agregar()`);
    await q.query(`DROP TABLE trial_requests`);
  }
}
