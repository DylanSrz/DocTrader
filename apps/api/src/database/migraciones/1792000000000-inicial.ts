import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 0: usuarios, socio, planes, ajustes, direcciones de depósito y auditoría.
 * Las migraciones se escriben a mano, en SQL, y se revisan antes de aplicarse en producción.
 */
export class Inicial1792000000000 implements MigrationInterface {
  name = 'Inicial1792000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS citext`);

    // UUID v7: ordenables por fecha. Se genera en la base de datos para no depender de la versión de Postgres.
    await q.query(`
      CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid AS $$
      DECLARE
        bytes bytea;
      BEGIN
        bytes := substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
              || substring(uuid_send(gen_random_uuid()) FROM 1 FOR 10);
        bytes := set_byte(bytes, 6, (b'0111' || get_byte(bytes, 6)::bit(4))::bit(8)::int);
        bytes := set_byte(bytes, 8, (b'10' || get_byte(bytes, 8)::bit(6))::bit(8)::int);
        RETURN encode(bytes, 'hex')::uuid;
      END
      $$ LANGUAGE plpgsql VOLATILE
    `);

    await q.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        role varchar(16) NOT NULL CHECK (role IN ('ADMIN', 'CLIENT')),
        status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED')),
        full_name text NOT NULL,
        cedula_enc bytea,
        cedula_hmac bytea UNIQUE,
        cedula_last4 char(4),
        email citext NOT NULL UNIQUE,
        email_canonical citext NOT NULL UNIQUE,
        email_verified_at timestamptz,
        phone_e164 text UNIQUE,
        phone_verified_at timestamptz,
        password_hash text,
        totp_secret_enc bytea,
        totp_enabled_at timestamptz,
        marketing_opt_in boolean NOT NULL DEFAULT false,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        -- Los clientes siempre tienen cédula y teléfono; los admins no los necesitan.
        CHECK (role = 'ADMIN' OR (cedula_hmac IS NOT NULL AND phone_e164 IS NOT NULL))
      )
    `);

    await q.query(`
      CREATE TABLE partner_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL UNIQUE REFERENCES users (id),
        commission_bp integer NOT NULL CHECK (commission_bp BETWEEN 0 AND 10000),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await q.query(`
      CREATE TABLE plans (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        code varchar(16) NOT NULL UNIQUE CHECK (code IN ('MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'PRUEBA')),
        name text NOT NULL,
        duration_months integer CHECK (duration_months > 0),
        bonus_months integer NOT NULL DEFAULT 0 CHECK (bonus_months >= 0),
        duration_days integer CHECK (duration_days > 0),
        price_usd_cents integer NOT NULL CHECK (price_usd_cents > 0),
        rank integer NOT NULL,
        is_public boolean NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        -- Un plan dura meses o días, nunca las dos cosas.
        CHECK ((duration_months IS NULL) <> (duration_days IS NULL))
      )
    `);

    await q.query(`
      CREATE TABLE settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_by uuid REFERENCES users (id),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await q.query(`
      CREATE TABLE deposit_addresses (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        currency varchar(8) NOT NULL CHECK (currency IN ('USDT', 'BTC')),
        network varchar(16) NOT NULL CHECK (network IN ('TRON', 'BITCOIN')),
        address text NOT NULL,
        status varchar(16) NOT NULL CHECK (status IN ('EN_ESPERA', 'ACTIVA', 'INACTIVA', 'CANCELADA')),
        activates_at timestamptz NOT NULL,
        created_by uuid REFERENCES users (id),
        cancelled_by uuid REFERENCES users (id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((currency = 'USDT' AND network = 'TRON') OR (currency = 'BTC' AND network = 'BITCOIN'))
      )
    `);
    // La misma dirección no puede estar dos veces, salvo que una esté cancelada.
    await q.query(`
      CREATE UNIQUE INDEX deposit_addresses_network_address_vigente
        ON deposit_addresses (network, address) WHERE status <> 'CANCELADA'
    `);

    await q.query(`
      CREATE TABLE audit_log (
        id bigserial PRIMARY KEY,
        actor_id uuid,
        actor_role varchar(16),
        action text NOT NULL,
        target_type text,
        target_id text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        ip text,
        user_agent text,
        created_at timestamptz NOT NULL,
        prev_hash bytea,
        hash bytea NOT NULL
      )
    `);
    await q.query(`CREATE INDEX audit_log_actor ON audit_log (actor_id, created_at)`);
    await q.query(`CREATE INDEX audit_log_target ON audit_log (target_type, target_id)`);

    // Nadie puede cambiar ni borrar la auditoría desde la aplicación.
    await q.query(`
      CREATE FUNCTION audit_log_inmutable() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log no se puede modificar ni borrar';
      END
      $$ LANGUAGE plpgsql
    `);
    await q.query(`
      CREATE TRIGGER audit_log_sin_cambios BEFORE UPDATE OR DELETE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION audit_log_inmutable()
    `);
    await q.query(`
      CREATE TRIGGER audit_log_sin_vaciar BEFORE TRUNCATE ON audit_log
        FOR EACH STATEMENT EXECUTE FUNCTION audit_log_inmutable()
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE audit_log`);
    await q.query(`DROP FUNCTION audit_log_inmutable()`);
    await q.query(`DROP TABLE deposit_addresses`);
    await q.query(`DROP TABLE settings`);
    await q.query(`DROP TABLE plans`);
    await q.query(`DROP TABLE partner_profiles`);
    await q.query(`DROP TABLE users`);
    await q.query(`DROP FUNCTION uuid_generate_v7()`);
  }
}
