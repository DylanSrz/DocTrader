import type { Red } from '@doctrader/shared';
import type { EntityManager } from 'typeorm';

/** Ajustes que usan las licencias y las órdenes, con los valores iniciales si alguien borró la fila. */
export interface AjustesLicencias {
  diasGracia: number;
  minutosOrden: number;
  confirmaciones: Record<Red, number>;
}

export async function leerAjustes(m: EntityManager): Promise<AjustesLicencias> {
  // Consulta directa: el tipo recursivo del JSON de `settings` es demasiado profundo para `findBy`.
  const filas = (await m.query(
    `SELECT key, value FROM settings WHERE key IN ('grace_days', 'order_ttl_minutes', 'min_confirmations')`,
  )) as { key: string; value: unknown }[];
  const valor = new Map(filas.map((f) => [f.key, f.value]));
  const confirmaciones = valor.get('min_confirmations') as Partial<Record<Red, number>> | undefined;
  return {
    diasGracia: entero(valor.get('grace_days'), 3, 0),
    minutosOrden: entero(valor.get('order_ttl_minutes'), 60),
    confirmaciones: {
      TRON: entero(confirmaciones?.TRON, 20),
      BITCOIN: entero(confirmaciones?.BITCOIN, 2),
    },
  };
}

function entero(valor: unknown, porDefecto: number, minimo = 1): number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= minimo
    ? valor
    : porDefecto;
}
