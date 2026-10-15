import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 3: cuentas de trading, licencias, periodos y órdenes de pago (`docs/MODELO-DATOS.md` §3.3 y §3.4).
 * Las reglas que no se pueden saltar viven también en la base de datos: una cuenta de trading en un solo cliente,
 * una licencia por cuenta, una orden abierta por licencia y un hash por red.
 */
export class LicenciasYOrdenes1792300000000 implements MigrationInterface {
  name = 'LicenciasYOrdenes1792300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE trading_accounts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL REFERENCES users (id),
        holder_name text NOT NULL,
        broker text NOT NULL,
        server text NOT NULL,
        account_number text NOT NULL,
        account_key_hmac bytea NOT NULL,
        account_number_hmac bytea NOT NULL,
        master_password_enc bytea,
        investor_password_enc bytea,
        passwords_purged_at timestamptz,
        connection_status varchar(16) NOT NULL DEFAULT 'SIN_LICENCIA' CHECK (connection_status IN
          ('SIN_LICENCIA', 'POR_CONECTAR', 'CONECTADA', 'POR_DESCONECTAR', 'DESCONECTADA')),
        connected_at timestamptz,
        connected_by uuid REFERENCES users (id),
        disconnected_at timestamptz,
        disconnected_by uuid REFERENCES users (id),
        recommended_capital_usd_cents integer CHECK (recommended_capital_usd_cents > 0),
        risk_level varchar(8) CHECK (risk_level IN ('BAJO', 'MEDIO', 'ALTO')),
        locked_until timestamptz,
        internal_notes text,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Una cuenta de trading solo puede estar en un cliente a la vez (MODELO-DATOS §6, regla 3).
    await q.query(`
      CREATE UNIQUE INDEX trading_accounts_cuenta_vigente
        ON trading_accounts (account_key_hmac) WHERE deleted_at IS NULL
    `);
    await q.query(`CREATE INDEX trading_accounts_usuario ON trading_accounts (user_id)`);
    await q.query(`CREATE INDEX trading_accounts_numero ON trading_accounts (account_number_hmac)`);

    await q.query(`
      CREATE TABLE licenses (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        trading_account_id uuid NOT NULL UNIQUE REFERENCES trading_accounts (id),
        user_id uuid NOT NULL REFERENCES users (id),
        plan_id uuid REFERENCES plans (id),
        status varchar(16) NOT NULL DEFAULT 'PENDIENTE_PAGO' CHECK (status IN
          ('PENDIENTE_PAGO', 'PRUEBA', 'ACTIVA', 'EN_GRACIA', 'VENCIDA', 'SUSPENDIDA')),
        is_trial boolean NOT NULL DEFAULT false,
        trial_started_at timestamptz,
        starts_at timestamptz,
        ends_at timestamptz,
        grace_ends_at timestamptz,
        suspended_at timestamptz,
        suspended_by uuid REFERENCES users (id),
        suspension_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        -- Sin pagar no hay fechas; con un periodo aprobado siempre las hay.
        CHECK (status = 'PENDIENTE_PAGO' OR (starts_at IS NOT NULL AND ends_at IS NOT NULL AND plan_id IS NOT NULL)),
        CHECK (ends_at IS NULL OR ends_at > starts_at)
      )
    `);
    await q.query(`CREATE INDEX licenses_usuario ON licenses (user_id)`);
    await q.query(`CREATE INDEX licenses_estado_fin ON licenses (status, ends_at)`);

    // Número que ve la gente: DTP-000001, DTP-000002, …
    await q.query(`CREATE SEQUENCE payment_order_number_seq`);
    await q.query(`
      CREATE TABLE payment_orders (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        number text NOT NULL UNIQUE
          DEFAULT 'DTP-' || lpad(nextval('payment_order_number_seq')::text, 6, '0'),
        user_id uuid NOT NULL REFERENCES users (id),
        trading_account_id uuid NOT NULL REFERENCES trading_accounts (id),
        license_id uuid NOT NULL REFERENCES licenses (id),
        plan_id uuid NOT NULL REFERENCES plans (id),
        type varchar(16) NOT NULL CHECK (type IN
          ('NUEVA', 'RENOVACION', 'CAMBIO_DE_PLAN', 'PRUEBA', 'COMPLETAR_PRUEBA')),
        price_usd_cents integer NOT NULL CHECK (price_usd_cents > 0),
        credit_usd_cents integer NOT NULL DEFAULT 0 CHECK (credit_usd_cents >= 0),
        amount_usd_cents integer NOT NULL CHECK (amount_usd_cents > 0),
        currency varchar(8) NOT NULL CHECK (currency IN ('USDT', 'BTC')),
        network varchar(16) NOT NULL CHECK (network IN ('TRON', 'BITCOIN')),
        deposit_address_id uuid NOT NULL REFERENCES deposit_addresses (id),
        deposit_address text NOT NULL,
        amount_base_units numeric(38, 0) NOT NULL CHECK (amount_base_units > 0),
        btc_usd_rate numeric(18, 2) CHECK (btc_usd_rate > 0),
        expires_at timestamptz NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN
          ('PENDIENTE', 'REPORTADA', 'APROBADA', 'RECHAZADA', 'EXPIRADA', 'CANCELADA')),
        tx_hash text,
        reported_at timestamptz,
        verification_status varchar(32) CHECK (verification_status IN ('SIN_VERIFICAR',
          'ESPERANDO_CONFIRMACIONES', 'VERIFICADA', 'MONTO_INCOMPLETO', 'NO_COINCIDE', 'ERROR_PROVEEDOR')),
        received_base_units numeric(38, 0),
        confirmations integer,
        tx_time timestamptz,
        block_height bigint,
        sender_addresses jsonb,
        verification_detail jsonb,
        decided_by uuid REFERENCES users (id),
        decided_at timestamptz,
        approval_mode varchar(8) CHECK (approval_mode IN ('MANUAL', 'AUTO')),
        rejection_reason text,
        commission_bp integer CHECK (commission_bp BETWEEN 0 AND 10000),
        commission_usd_cents integer CHECK (commission_usd_cents >= 0),
        commission_payout_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (amount_usd_cents = price_usd_cents - credit_usd_cents),
        CHECK ((currency = 'USDT' AND network = 'TRON') OR (currency = 'BTC' AND network = 'BITCOIN')),
        -- El precio de BTC se fija en las órdenes en BTC, y solo en ellas.
        CHECK ((currency = 'BTC') = (btc_usd_rate IS NOT NULL)),
        CHECK (status NOT IN ('REPORTADA', 'APROBADA') OR tx_hash IS NOT NULL),
        CHECK (expires_at > created_at)
      )
    `);
    // Un hash no se puede usar en dos órdenes, ni con dos peticiones al mismo tiempo (SEGURIDAD §6).
    await q.query(`
      CREATE UNIQUE INDEX payment_orders_hash_por_red
        ON payment_orders (network, tx_hash) WHERE tx_hash IS NOT NULL
    `);
    // Una sola orden abierta por licencia: una nueva reemplaza a la pendiente, pero no a una ya reportada.
    await q.query(`
      CREATE UNIQUE INDEX payment_orders_una_abierta
        ON payment_orders (license_id) WHERE status IN ('PENDIENTE', 'REPORTADA')
    `);
    await q.query(`CREATE INDEX payment_orders_usuario ON payment_orders (user_id, created_at)`);
    await q.query(`CREATE INDEX payment_orders_estado ON payment_orders (status, expires_at)`);

    await q.query(`
      CREATE TABLE license_periods (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        license_id uuid NOT NULL REFERENCES licenses (id),
        payment_order_id uuid UNIQUE REFERENCES payment_orders (id),
        plan_id uuid NOT NULL REFERENCES plans (id),
        kind varchar(24) NOT NULL CHECK (kind IN
          ('PRUEBA', 'NUEVA', 'RENOVACION', 'CAMBIO_DE_PLAN', 'COMPLETAR_PRUEBA', 'EXTENSION_ADMIN')),
        period_start timestamptz NOT NULL,
        period_end timestamptz NOT NULL,
        bonus_months integer NOT NULL DEFAULT 0 CHECK (bonus_months >= 0),
        created_by uuid REFERENCES users (id),
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (period_end > period_start),
        -- Todo periodo sale de un pago, salvo los días que extiende un admin.
        CHECK ((kind = 'EXTENSION_ADMIN') = (payment_order_id IS NULL))
      )
    `);
    await q.query(
      `CREATE INDEX license_periods_licencia ON license_periods (license_id, period_start)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE license_periods`);
    await q.query(`DROP TABLE payment_orders`);
    await q.query(`DROP SEQUENCE payment_order_number_seq`);
    await q.query(`DROP TABLE licenses`);
    await q.query(`DROP TABLE trading_accounts`);
  }
}
