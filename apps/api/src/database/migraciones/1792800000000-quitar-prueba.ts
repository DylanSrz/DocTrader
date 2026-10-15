import type { MigrationInterface, QueryRunner } from 'typeorm';
import { LicenciaDePrueba1792600000000 } from './1792600000000-licencia-de-prueba.js';

const RESPUESTA_VIEJA =
  'No. Por eso existe la prueba: 15 días por USD 50. Si sigues, pagas solo la diferencia del plan que elijas.';
const RESPUESTA_NUEVA =
  'No. Por eso puedes empezar con el plan mensual y, si te gusta, pasar al semestral antes de que venza: pagas el plan nuevo y los días se suman.';

/** Los textos legales publicados: la sección 6 de cada uno hablaba de la prueba y se reemplaza (sin renumerar). */
const SECCION_PRUEBA_TERMINOS = /## 6\. Licencia de prueba\n[\s\S]*?(?=\n## 7\.)/;
const NUEVA_SECCION_TERMINOS = `## 6. Sin licencia de prueba

6.1. DocTraderPRO no ofrece licencias de prueba. Para conocer el Software, el Cliente puede empezar con el plan
mensual y, antes de que venza, pasarlo al semestral (numeral 5.4).
`;
const TERMINOS: [string, string][] = [
  [
    '8.3. La licencia de prueba existe para que el Cliente conozca el Software antes de comprar un periodo más largo.',
    '8.3. Para conocer el Software antes de comprar un periodo largo, el Cliente puede empezar con el plan mensual.',
  ],
  [
    'datos falsos, intenta abusar de la prueba, comparte su licencia,',
    'datos falsos, comparte su licencia,',
  ],
];
const SECCION_PRUEBA_DATOS =
  /## 6\. Registro para el control de la licencia de prueba\n[\s\S]*?(?=\n## 7\.)/;
const NUEVA_SECCION_DATOS = `## 6. Datos cifrados para prevenir el fraude

Para evitar que una misma cédula o una misma cuenta de trading se registren dos veces, DocTraderPRO guarda una
**huella cifrada** de esos datos (un código generado con una clave secreta, que no permite leer el dato original) y
la compara al registrar uno nuevo. Las huellas se borran con el dato al que pertenecen y no se usan para nada más.
`;
const DATOS: [string, string][] = [
  [
    '| Foto del documento (opcional) | Imagen de la cédula | Solo si se pide para aprobar una prueba |\n',
    '',
  ],
  [
    'y no los trata. La foto del documento, cuando se pida, se usa solo para comparar el nombre y el número; no se hace\nreconocimiento facial.',
    'y no los trata.',
  ],
  [
    '1. Crear y administrar la cuenta del cliente y verificar su correo y su teléfono.',
    '1. Crear y administrar la cuenta del cliente y verificar su correo.',
  ],
  [
    '5. **Prevenir el fraude**, en especial que una misma persona o cuenta de trading obtenga más de una licencia de prueba\n   (ver el numeral 6).',
    '5. **Prevenir el fraude**, por ejemplo que una misma cuenta de trading o una misma cédula se registren dos veces\n   (ver el numeral 6).',
  ],
  [
    'envío de correos, envío de SMS y almacenamiento de\n  archivos.',
    'envío de correos y almacenamiento de archivos.',
  ],
  ['| Foto del documento | Hasta 30 días después de decidir la solicitud de prueba |\n', ''],
  [
    '| Huellas del control de la prueba | Mientras exista el programa de pruebas (numeral 6) |\n',
    '',
  ],
  [
    'prevenir\n> el fraude en la licencia de prueba y enviarme avisos',
    'prevenir\n> el fraude y enviarme avisos',
  ],
];

function corregir(
  texto: string,
  seccion: RegExp,
  nueva: string,
  pares: [string, string][],
): string {
  return pares.reduce(
    (t, [viejo, nuevo]) => t.split(viejo).join(nuevo),
    texto.replace(seccion, nueva),
  );
}

/**
 * Publica una versión nueva de los términos y de la política de datos sin la prueba, solo si el texto vigente todavía
 * la menciona. Lo demás del texto (lo que se haya editado en el panel) se respeta.
 */
export async function quitarPruebaDeTextosLegales(q: QueryRunner): Promise<void> {
  const documentos = [
    {
      tipo: 'TERMS',
      seccion: SECCION_PRUEBA_TERMINOS,
      nueva: NUEVA_SECCION_TERMINOS,
      pares: TERMINOS,
    },
    { tipo: 'PRIVACY', seccion: SECCION_PRUEBA_DATOS, nueva: NUEVA_SECCION_DATOS, pares: DATOS },
  ];
  for (const d of documentos) {
    const [vigente] = (await q.query(
      `SELECT version, content_md FROM legal_documents WHERE type = $1 ORDER BY version DESC LIMIT 1`,
      [d.tipo],
    )) as { version: number; content_md: string }[];
    if (!vigente) continue;
    const nuevo = corregir(vigente.content_md, d.seccion, d.nueva, d.pares);
    if (nuevo !== vigente.content_md) {
      await q.query(`INSERT INTO legal_documents (type, version, content_md) VALUES ($1, $2, $3)`, [
        d.tipo,
        vigente.version + 1,
        nuevo,
      ]);
    }
  }
}

/**
 * Se quita la licencia de prueba (decisión del 2026-10-15): sus tablas, el plan PRUEBA, los tipos de orden y de
 * periodo, el estado de licencia, el bloqueo de la cuenta durante la prueba y sus ajustes; y se publican los textos
 * legales sin ella. Si ya hubiera pruebas
 * pagadas, no se borra nada: hay que revisarlas a mano antes (en producción nunca se pudo pedir una, porque no hubo
 * SMS).
 */
export class QuitarPrueba1792800000000 implements MigrationInterface {
  name = 'QuitarPrueba1792800000000';

  async up(q: QueryRunner): Promise<void> {
    const [{ hay }] = (await q.query(`
      SELECT (SELECT count(*) FROM licenses WHERE status = 'PRUEBA' OR is_trial)
           + (SELECT count(*) FROM payment_orders o JOIN plans p ON p.id = o.plan_id
               WHERE o.type IN ('PRUEBA', 'COMPLETAR_PRUEBA') OR p.code = 'PRUEBA')
           + (SELECT count(*) FROM license_periods WHERE kind IN ('PRUEBA', 'COMPLETAR_PRUEBA')) AS hay
    `)) as { hay: string }[];
    if (Number(hay) > 0) {
      throw new Error(
        'Hay licencias, órdenes o periodos de prueba: revísalos antes de quitar la prueba (no se borran solos).',
      );
    }

    await q.query(`DROP TABLE trial_registry`);
    await q.query(`DROP FUNCTION trial_registry_solo_agregar()`);
    await q.query(`DROP TABLE trial_requests`);

    await q.query(`DELETE FROM plans WHERE code = 'PRUEBA'`);
    await q.query(`ALTER TABLE plans DROP CONSTRAINT plans_code_check`);
    await q.query(`
      ALTER TABLE plans ADD CONSTRAINT plans_code_check
        CHECK (code IN ('MENSUAL', 'TRIMESTRAL', 'SEMESTRAL'))
    `);
    await q.query(`ALTER TABLE licenses DROP CONSTRAINT licenses_status_check`);
    await q.query(`
      ALTER TABLE licenses ADD CONSTRAINT licenses_status_check
        CHECK (status IN ('PENDIENTE_PAGO', 'ACTIVA', 'EN_GRACIA', 'VENCIDA', 'SUSPENDIDA'))
    `);
    await q.query(`ALTER TABLE payment_orders DROP CONSTRAINT payment_orders_type_check`);
    await q.query(`
      ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_type_check
        CHECK (type IN ('NUEVA', 'RENOVACION', 'CAMBIO_DE_PLAN'))
    `);
    await q.query(`ALTER TABLE license_periods DROP CONSTRAINT license_periods_kind_check`);
    await q.query(`
      ALTER TABLE license_periods ADD CONSTRAINT license_periods_kind_check
        CHECK (kind IN ('NUEVA', 'RENOVACION', 'CAMBIO_DE_PLAN', 'EXTENSION_ADMIN'))
    `);
    await q.query(`ALTER TABLE licenses DROP COLUMN is_trial, DROP COLUMN trial_started_at`);
    await q.query(`ALTER TABLE trading_accounts DROP COLUMN locked_until`);

    await q.query(`DELETE FROM settings WHERE key LIKE 'trial.%'`);
    // La pregunta frecuente de las devoluciones hablaba de la prueba (solo si nadie la cambió).
    await q.query(
      `UPDATE settings
          SET value = (
            SELECT jsonb_agg(
                     CASE WHEN e->>'respuesta' = $1 THEN jsonb_set(e, '{respuesta}', to_jsonb($2::text)) ELSE e END
                     ORDER BY i)
              FROM jsonb_array_elements(value) WITH ORDINALITY AS t(e, i)),
              updated_at = now()
        WHERE key = 'faq' AND jsonb_typeof(value) = 'array' AND jsonb_array_length(value) > 0`,
      [RESPUESTA_VIEJA, RESPUESTA_NUEVA],
    );
    await quitarPruebaDeTextosLegales(q);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE trading_accounts ADD COLUMN locked_until timestamptz`);
    await q.query(`
      ALTER TABLE licenses ADD COLUMN is_trial boolean NOT NULL DEFAULT false,
                           ADD COLUMN trial_started_at timestamptz
    `);
    await q.query(`ALTER TABLE license_periods DROP CONSTRAINT license_periods_kind_check`);
    await q.query(`
      ALTER TABLE license_periods ADD CONSTRAINT license_periods_kind_check CHECK (kind IN
        ('PRUEBA', 'NUEVA', 'RENOVACION', 'CAMBIO_DE_PLAN', 'COMPLETAR_PRUEBA', 'EXTENSION_ADMIN'))
    `);
    await q.query(`ALTER TABLE payment_orders DROP CONSTRAINT payment_orders_type_check`);
    await q.query(`
      ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_type_check CHECK (type IN
        ('NUEVA', 'RENOVACION', 'CAMBIO_DE_PLAN', 'PRUEBA', 'COMPLETAR_PRUEBA'))
    `);
    await q.query(`ALTER TABLE licenses DROP CONSTRAINT licenses_status_check`);
    await q.query(`
      ALTER TABLE licenses ADD CONSTRAINT licenses_status_check CHECK (status IN
        ('PENDIENTE_PAGO', 'PRUEBA', 'ACTIVA', 'EN_GRACIA', 'VENCIDA', 'SUSPENDIDA'))
    `);
    await q.query(`ALTER TABLE plans DROP CONSTRAINT plans_code_check`);
    await q.query(`
      ALTER TABLE plans ADD CONSTRAINT plans_code_check
        CHECK (code IN ('MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'PRUEBA'))
    `);
    await q.query(`
      INSERT INTO plans (code, name, duration_months, bonus_months, duration_days, price_usd_cents, rank, is_public)
      VALUES ('PRUEBA', 'Prueba', NULL, 0, 15, 5000, 0, false)
    `);
    await new LicenciaDePrueba1792600000000().up(q);
  }
}
