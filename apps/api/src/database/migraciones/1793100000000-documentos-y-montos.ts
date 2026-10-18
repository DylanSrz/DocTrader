import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Pagos: en USDT se cobra el precio exacto, así que un pago puede quedar "por confirmar" cuando otro cliente tenía
 *   una orden abierta por el mismo monto (`ESTADO_VERIFICACION.POR_CONFIRMAR`).
 * - Términos: la tabla de precios escrita a mano (que no cambiaba al editar los precios en el panel) se cambia por el
 *   marcador `{{precios}}`, que la página reemplaza por los precios vigentes (`sustituirPrecios`). Se publica como
 *   versión nueva, solo si el texto vigente todavía tiene la tabla vieja.
 * - Registro internacional: el documento guarda su país emisor y su tipo (`@doctrader/shared`, `documentos.ts`). El
 *   número sigue en `cedula_enc` / `cedula_hmac` / `cedula_last4`. Los clientes de antes quedan como cédula de
 *   ciudadanía de Colombia, que es lo único que se podía registrar.
 */
const TABLA_VIEJA = `5.1. Los planes vigentes a la fecha de esta versión son:

| Plan | Duración | Precio |
|---|---|---|
| Mensual | 1 mes | USD 120 |
| Semestral | 6 meses | USD 499 |`;
const TABLA_NUEVA = `5.1. Los planes y precios vigentes son los que se publican en la plataforma:

{{precios}}`;

export class DocumentosYMontos1793100000000 implements MigrationInterface {
  name = 'DocumentosYMontos1793100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE payment_orders DROP CONSTRAINT payment_orders_verification_status_check`,
    );
    await q.query(`
      ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_verification_status_check
        CHECK (verification_status IN ('SIN_VERIFICAR', 'ESPERANDO_CONFIRMACIONES', 'VERIFICADA',
          'POR_CONFIRMAR', 'MONTO_INCOMPLETO', 'NO_COINCIDE', 'ERROR_PROVEEDOR'))
    `);

    const [terminos] = (await q.query(
      `SELECT version, content_md FROM legal_documents WHERE type = 'TERMS' ORDER BY version DESC LIMIT 1`,
    )) as { version: number; content_md: string }[];
    if (terminos?.content_md.includes(TABLA_VIEJA)) {
      await q.query(
        `INSERT INTO legal_documents (type, version, content_md) VALUES ('TERMS', $1, $2)`,
        [terminos.version + 1, terminos.content_md.replace(TABLA_VIEJA, TABLA_NUEVA)],
      );
    }

    await q.query(`
      ALTER TABLE users
        ADD COLUMN document_country char(2) CHECK (document_country ~ '^[A-Z]{2}$'),
        ADD COLUMN document_type varchar(16) CHECK (document_type ~ '^[A-Z0-9_]{2,16}$')
    `);
    await q.query(`
      UPDATE users SET document_country = 'CO', document_type = 'CC'
       WHERE cedula_hmac IS NOT NULL
    `);
    await q.query(`
      ALTER TABLE users ADD CONSTRAINT users_documento_completo CHECK (
        (cedula_hmac IS NULL) OR (document_country IS NOT NULL AND document_type IS NOT NULL)
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP CONSTRAINT users_documento_completo`);
    await q.query(`ALTER TABLE users DROP COLUMN document_type, DROP COLUMN document_country`);
    await q.query(`UPDATE payment_orders SET verification_status = 'VERIFICADA'
                    WHERE verification_status = 'POR_CONFIRMAR'`);
    await q.query(
      `ALTER TABLE payment_orders DROP CONSTRAINT payment_orders_verification_status_check`,
    );
    await q.query(`
      ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_verification_status_check
        CHECK (verification_status IN ('SIN_VERIFICAR', 'ESPERANDO_CONFIRMACIONES', 'VERIFICADA',
          'MONTO_INCOMPLETO', 'NO_COINCIDE', 'ERROR_PROVEEDOR'))
    `);
  }
}
