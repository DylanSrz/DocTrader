import type { DataSource } from 'typeorm';

/** La frase que hay que escribir en `CONFIRMAR_LIMPIEZA` para borrar de verdad. */
export const FRASE_LIMPIEZA = 'borrar-todos-los-clientes';

/** Lo que se borra, en orden (respeta las llaves foráneas). Todo es de prueba antes del lanzamiento. */
const PASOS: { tabla: string; donde?: string }[] = [
  { tabla: 'tickets' }, // con sus mensajes
  { tabla: 'files' },
  { tabla: 'notifications' },
  { tabla: 'license_periods' },
  { tabla: 'payment_orders' },
  { tabla: 'commission_payouts' },
  { tabla: 'licenses' },
  { tabla: 'trading_accounts' },
  { tabla: 'consents', donde: `user_id IN (SELECT id FROM users WHERE role = 'CLIENT')` },
  { tabla: 'user_devices', donde: `user_id IN (SELECT id FROM users WHERE role = 'CLIENT')` },
  { tabla: 'auth_tokens', donde: `user_id IN (SELECT id FROM users WHERE role = 'CLIENT')` },
  { tabla: 'recovery_codes', donde: `user_id IN (SELECT id FROM users WHERE role = 'CLIENT')` },
  { tabla: 'users', donde: `role = 'CLIENT'` },
];

export type ConteoLimpieza = Record<string, number>;

/**
 * Deja la base de datos lista para el lanzamiento (`docs/PLAN-TRABAJO.md` §5): borra todos los clientes de prueba con
 * sus cuentas, licencias, órdenes, tickets, adjuntos y correos, y reinicia los números de orden y de ticket. Se
 * conservan los admins, el socio y su historial de porcentaje, los ajustes, los planes, las direcciones de depósito,
 * los textos legales, las preguntas y las respuestas guardadas. La auditoría no se toca: no admite borrados.
 *
 * Sin `confirmar` solo cuenta lo que borraría (y no cambia nada).
 */
export async function limpiarParaLanzamiento(
  fuente: DataSource,
  confirmar: boolean,
): Promise<ConteoLimpieza> {
  return fuente.transaction(async (m) => {
    const conteo: ConteoLimpieza = {};
    for (const paso of PASOS) {
      const donde = paso.donde ? ` WHERE ${paso.donde}` : '';
      const [fila] = (await m.query(`SELECT count(*)::int AS n FROM ${paso.tabla}${donde}`)) as {
        n: number;
      }[];
      conteo[paso.tabla] = fila!.n;
      if (confirmar) await m.query(`DELETE FROM ${paso.tabla}${donde}`);
    }
    if (confirmar) {
      await m.query(`ALTER SEQUENCE payment_order_number_seq RESTART WITH 1`);
      await m.query(`ALTER SEQUENCE ticket_number_seq RESTART WITH 1000`);
    }
    return conteo;
  });
}
