import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lanzamiento (2026-10-23): los datos del responsable que la Ley 1581 pide en la política de datos (y que los términos
 * repiten) reemplazan los corchetes de los borradores. Publica una versión nueva de cada texto que todavía los tenga;
 * si ya no están (porque un admin los llenó desde el panel), no hace nada. Las versiones viejas se conservan: las
 * autorizaciones apuntan al texto que cada persona aceptó.
 */
export const DATOS_RESPONSABLE: Record<string, string> = {
  '[NIT o cédula del titular]': 'NIT 901001001',
  '[dirección física]': 'Calle 10 No 10 - 10, Barranquilla',
  '[teléfono de contacto]': '310 100 1000',
};

/** El texto con los datos del responsable, o `null` si no tiene ninguno de los corchetes. */
export function conDatosResponsable(texto: string): string | null {
  const faltan = Object.keys(DATOS_RESPONSABLE).filter((c) => texto.includes(c));
  if (faltan.length === 0) return null;
  return faltan.reduce((t, c) => t.replaceAll(c, DATOS_RESPONSABLE[c]!), texto);
}

export class DatosResponsable1793500000000 implements MigrationInterface {
  name = 'DatosResponsable1793500000000';

  async up(q: QueryRunner): Promise<void> {
    for (const tipo of ['TERMS', 'PRIVACY']) {
      const [vigente] = (await q.query(
        `SELECT version, content_md FROM legal_documents WHERE type = $1 ORDER BY version DESC LIMIT 1`,
        [tipo],
      )) as { version: number; content_md: string }[];
      if (!vigente) continue;
      const nuevo = conDatosResponsable(vigente.content_md);
      if (!nuevo) continue;
      await q.query(`INSERT INTO legal_documents (type, version, content_md) VALUES ($1, $2, $3)`, [
        tipo,
        vigente.version + 1,
        nuevo,
      ]);
    }
  }

  async down(): Promise<void> {
    // Las versiones publicadas son historia: las autorizaciones de los clientes apuntan a ellas.
  }
}
