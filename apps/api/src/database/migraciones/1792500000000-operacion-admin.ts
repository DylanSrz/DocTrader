import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 5 (operación del admin):
 * - `trading_accounts.connection_changed_at`: desde cuándo una cuenta está "por conectar" o "por desconectar". Lo
 *   mantiene un disparador de la base de datos, así ningún cambio de estado (API, worker o pagos) se olvida de él.
 * - `license_periods.note`: el motivo de los días que extiende un admin, para verlo en la ficha.
 */
export class OperacionAdmin1792500000000 implements MigrationInterface {
  name = 'OperacionAdmin1792500000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE trading_accounts ADD COLUMN connection_changed_at timestamptz`);
    await q.query(`UPDATE trading_accounts SET connection_changed_at = updated_at`);
    await q.query(`
      ALTER TABLE trading_accounts
        ALTER COLUMN connection_changed_at SET NOT NULL,
        ALTER COLUMN connection_changed_at SET DEFAULT now()
    `);
    await q.query(`
      CREATE FUNCTION trading_accounts_marcar_cambio_conexion() RETURNS trigger AS $$
      BEGIN
        IF NEW.connection_status IS DISTINCT FROM OLD.connection_status THEN
          NEW.connection_changed_at := now();
        END IF;
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `);
    await q.query(`
      CREATE TRIGGER trading_accounts_cambio_conexion
        BEFORE UPDATE OF connection_status ON trading_accounts
        FOR EACH ROW EXECUTE FUNCTION trading_accounts_marcar_cambio_conexion()
    `);
    await q.query(
      `CREATE INDEX trading_accounts_conexion ON trading_accounts (connection_status) WHERE deleted_at IS NULL`,
    );

    await q.query(
      `ALTER TABLE license_periods ADD COLUMN note text CHECK (note IS NULL OR length(note) <= 500)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE license_periods DROP COLUMN note`);
    await q.query(`DROP INDEX trading_accounts_conexion`);
    await q.query(`DROP TRIGGER trading_accounts_cambio_conexion ON trading_accounts`);
    await q.query(`DROP FUNCTION trading_accounts_marcar_cambio_conexion()`);
    await q.query(`ALTER TABLE trading_accounts DROP COLUMN connection_changed_at`);
  }
}
