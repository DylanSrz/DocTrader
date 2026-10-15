import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 2: textos legales con versiones. Cada publicación es una fila nueva (nunca se edita una vieja), así cada
 * autorización del registro apunta al texto exacto que la persona aceptó.
 */
export class PaginaPublica1792200000000 implements MigrationInterface {
  name = 'PaginaPublica1792200000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE legal_documents (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        type varchar(16) NOT NULL CHECK (type IN ('TERMS', 'PRIVACY', 'RISK')),
        version integer NOT NULL CHECK (version > 0),
        content_md text NOT NULL,
        published_at timestamptz NOT NULL DEFAULT now(),
        published_by uuid REFERENCES users (id),
        UNIQUE (type, version)
      )
    `);
    // Los textos publicados no se cambian ni se borran: una corrección es una versión nueva.
    await q.query(`
      CREATE FUNCTION legal_documents_inmutable() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'legal_documents no se puede modificar ni borrar: publica una versión nueva';
      END
      $$ LANGUAGE plpgsql
    `);
    await q.query(`
      CREATE TRIGGER legal_documents_sin_cambios BEFORE UPDATE OR DELETE ON legal_documents
        FOR EACH ROW EXECUTE FUNCTION legal_documents_inmutable()
    `);
    await q.query(
      `ALTER TABLE consents ADD COLUMN legal_document_id uuid REFERENCES legal_documents (id)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE consents DROP COLUMN legal_document_id`);
    await q.query(`DROP TABLE legal_documents`);
    await q.query(`DROP FUNCTION legal_documents_inmutable()`);
  }
}
