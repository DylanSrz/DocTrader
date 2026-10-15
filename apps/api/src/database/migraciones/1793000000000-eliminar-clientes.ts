import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 9: un admin puede eliminar la cuenta de un cliente que lo pida (`docs/legal/politica-datos.md` §9). El
 * cliente queda anonimizado (sin nombre, cédula, correo ni teléfono reales), así que la regla que exige cédula y
 * teléfono a los clientes deja de aplicar a los eliminados.
 */
export class EliminarClientes1793000000000 implements MigrationInterface {
  name = 'EliminarClientes1793000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP CONSTRAINT users_check`);
    await q.query(`
      ALTER TABLE users ADD CONSTRAINT users_check CHECK (
        role = 'ADMIN' OR status = 'DELETED' OR (cedula_hmac IS NOT NULL AND phone_e164 IS NOT NULL)
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP CONSTRAINT users_check`);
    await q.query(`
      ALTER TABLE users ADD CONSTRAINT users_check
        CHECK (role = 'ADMIN' OR (cedula_hmac IS NOT NULL AND phone_e164 IS NOT NULL))
    `);
  }
}
