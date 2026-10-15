import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Respuestas guardadas iniciales: los admins las cambian desde el panel. Hablan en plural, como la marca. */
const RESPUESTAS_INICIALES = [
  {
    title: 'Pedir el hash del pago',
    body: 'Hola. Para revisar tu pago necesitamos el código de la transacción (hash) y la red por la que lo enviaste (USDT en Tron o BTC). Puedes pegarlo aquí mismo.',
  },
  {
    title: 'Pago esperando confirmaciones',
    body: 'Hola. Tu pago ya está en la blockchain y está sumando confirmaciones. Apenas tenga las necesarias lo aprobamos y te llega un correo; no tienes que hacer nada más.',
  },
  {
    title: 'Cuenta conectada',
    body: 'Hola. Tu cuenta ya quedó conectada al copy trading. Si ves algo raro en las operaciones, escríbenos por aquí.',
  },
  {
    title: 'Cambio de servidor o contraseña',
    body: 'Hola. Puedes cambiar el servidor o las contraseñas desde Mis cuentas, en "Editar datos". Al guardarlos, la cuenta vuelve a "por conectar" y la reconectamos.',
  },
];

/**
 * Etapa 7 (soporte, `docs/MODELO-DATOS.md` §3.6 y §4.5):
 * - `tickets` con su número visible (desde 1000), `ticket_messages` (con notas internas) y `saved_replies`.
 * - `files`: los adjuntos, guardados con un nombre aleatorio en el almacenamiento privado. Un archivo recién subido
 *   todavía no tiene mensaje y lleva `delete_after`: si nadie lo adjunta, el worker lo borra.
 */
export class Soporte1792700000000 implements MigrationInterface {
  name = 'Soporte1792700000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE SEQUENCE ticket_number_seq START 1000`);
    await q.query(`
      CREATE TABLE tickets (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        number integer NOT NULL UNIQUE DEFAULT nextval('ticket_number_seq'),
        user_id uuid NOT NULL REFERENCES users (id),
        topic varchar(16) NOT NULL CHECK (topic IN ('PAGOS', 'CONEXION', 'LICENCIA', 'TECNICO', 'OTRO')),
        trading_account_id uuid REFERENCES trading_accounts (id) ON DELETE SET NULL,
        payment_order_id uuid REFERENCES payment_orders (id) ON DELETE SET NULL,
        subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 160),
        status varchar(16) NOT NULL DEFAULT 'ABIERTO'
          CHECK (status IN ('ABIERTO', 'RESPONDIDO', 'RESUELTO', 'CERRADO')),
        priority varchar(8) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL', 'ALTA')),
        assigned_to uuid REFERENCES users (id),
        first_response_at timestamptz,
        last_client_message_at timestamptz NOT NULL DEFAULT now(),
        last_message_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        closed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((status IN ('RESUELTO', 'CERRADO')) = (resolved_at IS NOT NULL)),
        CHECK ((status = 'CERRADO') = (closed_at IS NOT NULL))
      )
    `);
    await q.query(`ALTER SEQUENCE ticket_number_seq OWNED BY tickets.number`);
    await q.query(`CREATE INDEX tickets_cliente ON tickets (user_id, last_message_at DESC)`);
    await q.query(`CREATE INDEX tickets_bandeja ON tickets (status, last_client_message_at)`);

    await q.query(`
      CREATE TABLE ticket_messages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        ticket_id uuid NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
        author_id uuid NOT NULL REFERENCES users (id),
        body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
        is_internal boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX ticket_messages_hilo ON ticket_messages (ticket_id, created_at)`);

    await q.query(`
      CREATE TABLE files (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        owner_user_id uuid NOT NULL REFERENCES users (id),
        purpose varchar(20) NOT NULL CHECK (purpose IN ('TICKET_ADJUNTO', 'FOTO_DOCUMENTO')),
        ticket_message_id uuid REFERENCES ticket_messages (id) ON DELETE SET NULL,
        storage_key text NOT NULL UNIQUE,
        original_name text NOT NULL CHECK (length(original_name) BETWEEN 1 AND 100),
        mime varchar(32) NOT NULL
          CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
        size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
        sha256 bytea NOT NULL,
        is_encrypted boolean NOT NULL DEFAULT false,
        delete_after timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX files_mensaje ON files (ticket_message_id)`);
    await q.query(
      `CREATE INDEX files_por_borrar ON files (delete_after) WHERE delete_after IS NOT NULL`,
    );

    await q.query(`
      CREATE TABLE saved_replies (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        title text NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
        body text NOT NULL CHECK (length(body) BETWEEN 1 AND 3000),
        created_by uuid REFERENCES users (id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX saved_replies_titulo ON saved_replies (lower(title))`);
    for (const r of RESPUESTAS_INICIALES) {
      await q.query(`INSERT INTO saved_replies (title, body) VALUES ($1, $2)`, [r.title, r.body]);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE saved_replies`);
    await q.query(`DROP TABLE files`);
    await q.query(`DROP TABLE ticket_messages`);
    await q.query(`DROP TABLE tickets`);
  }
}
