import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 1: enlaces de un solo uso, códigos de recuperación, dispositivos conocidos, autorizaciones (Ley 1581) y la
 * bandeja de salida de avisos. Las sesiones viven en Redis, no aquí.
 */
export class CuentasYAcceso1792100000000 implements MigrationInterface {
  name = 'CuentasYAcceso1792100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE auth_tokens (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL REFERENCES users (id),
        purpose varchar(32) NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD', 'CHANGE_EMAIL')),
        token_hash bytea NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX auth_tokens_user ON auth_tokens (user_id, purpose)`);

    await q.query(`
      CREATE TABLE recovery_codes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL REFERENCES users (id),
        code_hash bytea NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, code_hash)
      )
    `);

    await q.query(`
      CREATE TABLE user_devices (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL REFERENCES users (id),
        device_hash bytea NOT NULL,
        user_agent text,
        last_ip text,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, device_hash)
      )
    `);

    // La versión del texto se guarda como texto; en la etapa 2 se enlaza con legal_documents.
    await q.query(`
      CREATE TABLE consents (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL REFERENCES users (id),
        type varchar(16) NOT NULL CHECK (type IN ('TERMS', 'PRIVACY', 'RISK', 'MARKETING')),
        document_version text,
        accepted_at timestamptz NOT NULL DEFAULT now(),
        ip text,
        user_agent text,
        revoked_at timestamptz
      )
    `);
    await q.query(`CREATE INDEX consents_user ON consents (user_id, type)`);

    // Bandeja de salida: la API escribe aquí, dentro de la misma transacción que la acción, y el worker envía.
    // `secret_enc` guarda cifrado el enlace de un solo uso que va en el correo; se borra al enviarlo.
    await q.query(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid REFERENCES users (id),
        channel varchar(8) NOT NULL CHECK (channel IN ('EMAIL', 'SMS')),
        recipient text NOT NULL,
        template text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        secret_enc bytea,
        dedupe_key text UNIQUE,
        status varchar(16) NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'ENVIADA', 'FALLIDA')),
        attempts integer NOT NULL DEFAULT 0,
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        provider_message_id text,
        sent_at timestamptz,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX notifications_pendientes ON notifications (next_attempt_at) WHERE status = 'PENDIENTE'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE notifications`);
    await q.query(`DROP TABLE consents`);
    await q.query(`DROP TABLE user_devices`);
    await q.query(`DROP TABLE recovery_codes`);
    await q.query(`DROP TABLE auth_tokens`);
  }
}
