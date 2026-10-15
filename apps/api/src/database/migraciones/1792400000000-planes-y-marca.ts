import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cambios del 2026-10-15:
 * - La licencia trimestral ya no se vende (queda inactiva: las órdenes viejas la siguen nombrando).
 * - La semestral dura 6 meses, sin mes de obsequio.
 * - El nombre del dueño no aparece en la plataforma: en su lugar va "DocTrader Pro".
 *
 * Los términos de la licencia publicados nombran el plan trimestral y el mes de obsequio: se publica una versión
 * nueva con esos párrafos corregidos (solo si el texto vigente todavía los tiene). Las preguntas frecuentes que se
 * editaron desde el panel se respetan; solo se corrige la frase en primera persona del broker.
 */

/** Reemplazos en los términos: cada par es [texto viejo, texto nuevo]. */
const TERMINOS: [string, string][] = [
  ['| Trimestral | 3 meses | USD 319 |\n', ''],
  [
    '| Semestral | 7 meses (6 meses + 1 mes de obsequio) | USD 499 |',
    '| Semestral | 6 meses | USD 499 |',
  ],
  [
    'una licencia mensual puede pasarse a trimestral o semestral, y\nuna trimestral a semestral. Se paga',
    'una licencia mensual puede pasarse a semestral. Se paga',
  ],
  [
    '\n\n5.5. El mes de obsequio del plan semestral se aplica de forma automática y no se puede cambiar por dinero.',
    '',
  ],
  [
    '(hoy USD 70 para mensual, USD 269 para trimestral y USD 449 para semestral)',
    '(hoy USD 70 para mensual y USD 449 para semestral)',
  ],
  ['; si es semestral, incluye el mes de obsequio.', '.'],
];

const PREGUNTAS: [string, string][] = [
  ['Si no tienes uno, yo uso [JustMarkets]', 'Si no tienes uno, te sugerimos [JustMarkets]'],
  ['Argemiro te recomienda', 'DocTrader Pro te recomienda'],
];

function reemplazar(texto: string, pares: [string, string][]): string {
  return pares.reduce((t, [viejo, nuevo]) => t.split(viejo).join(nuevo), texto);
}

export class PlanesYMarca1792400000000 implements MigrationInterface {
  name = 'PlanesYMarca1792400000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE plans SET is_active = false, is_public = false, updated_at = now() WHERE code = 'TRIMESTRAL'`,
    );
    await q.query(`UPDATE plans SET bonus_months = 0, updated_at = now() WHERE code = 'SEMESTRAL'`);
    await q.query(
      `UPDATE users SET full_name = 'DocTrader Pro', updated_at = now()
        WHERE email = 'doctraderproiasystem@gmail.com' AND full_name = 'Argemiro'`,
    );
    // El admin retirado (correo equivocado) también llevaba el nombre.
    await q.query(
      `UPDATE users SET full_name = 'Admin retirado', updated_at = now()
        WHERE email = 'doctraderpro@gmail.com' AND full_name = 'Argemiro'`,
    );

    const [terminos] = (await q.query(
      `SELECT version, content_md FROM legal_documents WHERE type = 'TERMS' ORDER BY version DESC LIMIT 1`,
    )) as { version: number; content_md: string }[];
    if (terminos) {
      const nuevo = reemplazar(terminos.content_md, TERMINOS);
      if (nuevo !== terminos.content_md) {
        await q.query(
          `INSERT INTO legal_documents (type, version, content_md) VALUES ('TERMS', $1, $2)`,
          [terminos.version + 1, nuevo],
        );
      }
    }

    const [faq] = (await q.query(`SELECT value FROM settings WHERE key = 'faq'`)) as {
      value: { pregunta: string; respuesta: string }[];
    }[];
    if (faq && Array.isArray(faq.value)) {
      const corregidas = faq.value.map((p) => ({
        ...p,
        respuesta: reemplazar(p.respuesta, PREGUNTAS),
      }));
      if (JSON.stringify(corregidas) !== JSON.stringify(faq.value)) {
        await q.query(
          `UPDATE settings SET value = $1::jsonb, updated_at = now() WHERE key = 'faq'`,
          [JSON.stringify(corregidas)],
        );
      }
    }
  }

  async down(q: QueryRunner): Promise<void> {
    // Los textos publicados no se borran (la base de datos no lo permite); solo vuelven los planes.
    await q.query(`UPDATE plans SET is_active = true, is_public = true WHERE code = 'TRIMESTRAL'`);
    await q.query(`UPDATE plans SET bonus_months = 1 WHERE code = 'SEMESTRAL'`);
  }
}
