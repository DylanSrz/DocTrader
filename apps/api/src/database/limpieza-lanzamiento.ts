import type { EntityManager } from 'typeorm';

/** La frase que hay que escribir en `CONFIRMAR_LIMPIEZA` para borrar de verdad. */
export const FRASE_LIMPIEZA = 'borrar-todos-los-clientes';

/** En `settings`: cuándo se limpió. Con esta marca, la limpieza confirmada no se vuelve a correr. */
export const MARCA_LIMPIEZA = 'launch_cleanup_at';

/** Lo que se borra, en orden (respeta las llaves foráneas). Todo es de prueba antes del lanzamiento. */
const PASOS: { tabla: string; donde?: string }[] = [
  { tabla: 'tickets' }, // con sus mensajes
  { tabla: 'files' },
  { tabla: 'notifications' },
  { tabla: 'license_periods' },
  { tabla: 'referral_commissions' },
  { tabla: 'referral_payouts' }, // también los del socio: eran de prueba
  { tabla: 'payment_orders' },
  { tabla: 'commission_payouts' },
  { tabla: 'licenses' },
  { tabla: 'trading_accounts' },
  { tabla: 'consents', donde: `user_id IN (SELECT id FROM users WHERE role = 'CLIENT')` },
  { tabla: 'user_devices', donde: `user_id IN (SELECT id FROM users WHERE role = 'CLIENT')` },
  { tabla: 'auth_tokens', donde: `user_id IN (SELECT id FROM users WHERE role = 'CLIENT')` },
  { tabla: 'recovery_codes', donde: `user_id IN (SELECT id FROM users WHERE role = 'CLIENT')` },
  // Los perfiles de los admins se quedan: el socio conserva su código y su dirección de cobro.
  { tabla: 'referral_profiles', donde: `user_id IN (SELECT id FROM users WHERE role = 'CLIENT')` },
  { tabla: 'users', donde: `role = 'CLIENT'` },
];

export type ConteoLimpieza = Record<string, number>;

export interface ResultadoLimpieza {
  /** Filas por tabla: las que se borraron (o se borrarían, sin confirmar). */
  borrado: ConteoLimpieza;
  /** Usuarios por rol después de la limpieza (o hoy, sin confirmar). */
  quedan: ConteoLimpieza;
}

/**
 * Deja la base de datos lista para el lanzamiento (`docs/PLAN-TRABAJO.md` §5): borra todos los clientes de prueba con
 * sus cuentas, licencias, órdenes, tickets, adjuntos, correos y referidos, y reinicia los números de orden y de
 * ticket. Se conservan los admins, el socio con su historial de porcentaje y su perfil de referidos, los ajustes, los
 * planes, las direcciones de depósito, los textos legales, las preguntas y las respuestas guardadas. La auditoría no
 * se toca: no admite borrados.
 *
 * Sin `confirmar` solo cuenta lo que borraría (y no cambia nada). Confirmada se corre una sola vez: deja la marca
 * `launch_cleanup_at` en `settings` y, si ya existe, se niega (así no borra a los clientes reales si la variable de
 * confirmación quedara puesta). Va dentro de la transacción de quien llama.
 */
export async function limpiarParaLanzamiento(
  m: EntityManager,
  confirmar: boolean,
): Promise<ResultadoLimpieza> {
  if (confirmar) {
    const [marca] = (await m.query(`SELECT value FROM settings WHERE key = $1`, [
      MARCA_LIMPIEZA,
    ])) as { value: string }[];
    if (marca) {
      throw new Error(`La base de datos ya se limpió (${marca.value}): no se vuelve a limpiar.`);
    }
  }
  const borrado: ConteoLimpieza = {};
  for (const paso of PASOS) {
    const donde = paso.donde ? ` WHERE ${paso.donde}` : '';
    const [fila] = (await m.query(`SELECT count(*)::int AS n FROM ${paso.tabla}${donde}`)) as {
      n: number;
    }[];
    borrado[paso.tabla] = fila!.n;
    if (confirmar) await m.query(`DELETE FROM ${paso.tabla}${donde}`);
  }
  if (confirmar) {
    await m.query(`ALTER SEQUENCE payment_order_number_seq RESTART WITH 1`);
    await m.query(`ALTER SEQUENCE ticket_number_seq RESTART WITH 1000`);
    await m.query(`INSERT INTO settings (key, value) VALUES ($1, to_jsonb(now()::text))`, [
      MARCA_LIMPIEZA,
    ]);
  }
  const filas = (await m.query(
    `SELECT role, count(*)::int AS n FROM users GROUP BY role ORDER BY role`,
  )) as { role: string; n: number }[];
  return { borrado, quedan: Object.fromEntries(filas.map((f) => [f.role, f.n])) };
}
