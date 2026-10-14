import { createHmac } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { AuditLog } from '../database/entidades/index.js';

export interface EntradaAuditoria {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/** Número fijo para el candado de Postgres que ordena las escrituras de la auditoría. */
const CANDADO_AUDITORIA = 7_321_001;

/**
 * Hash de una fila: HMAC con llave secreta sobre el hash anterior y el contenido. Con la llave fuera de la base de
 * datos, quien logre cambiar una fila no puede recalcular la cadena.
 */
export function calcularHash(
  llave: Buffer,
  prevHash: Buffer | null,
  entrada: EntradaAuditoria,
  creadoEn: Date,
): Buffer {
  const contenido = JSON.stringify([
    entrada.actorId ?? null,
    entrada.actorRole ?? null,
    entrada.action,
    entrada.targetType ?? null,
    entrada.targetId ?? null,
    ordenarClaves(entrada.metadata ?? {}),
    entrada.ip ?? null,
    entrada.userAgent ?? null,
    creadoEn.toISOString(),
  ]);
  return createHmac('sha256', llave)
    .update(prevHash ?? Buffer.alloc(0))
    .update(contenido)
    .digest();
}

/**
 * Escribe una fila en la cadena. Debe ir dentro de una transacción: el candado espera a que termine cualquier otra
 * escritura de auditoría, así dos filas nunca apuntan al mismo hash anterior.
 */
export async function registrarEnCadena(
  manager: EntityManager,
  llave: Buffer,
  entrada: EntradaAuditoria,
): Promise<AuditLog> {
  if (!manager.queryRunner?.isTransactionActive) {
    throw new Error('La auditoría se escribe dentro de una transacción');
  }
  await manager.query('SELECT pg_advisory_xact_lock($1)', [CANDADO_AUDITORIA]);
  const ultima = await manager
    .getRepository(AuditLog)
    .createQueryBuilder('a')
    .select(['a.id', 'a.hash'])
    .orderBy('a.id', 'DESC')
    .limit(1)
    .getOne();

  const prevHash = ultima?.hash ?? null;
  const creadoEn = new Date();
  const fila = manager.getRepository(AuditLog).create({
    actorId: entrada.actorId ?? null,
    actorRole: entrada.actorRole ?? null,
    action: entrada.action,
    targetType: entrada.targetType ?? null,
    targetId: entrada.targetId ?? null,
    metadata: entrada.metadata ?? {},
    ip: entrada.ip ?? null,
    userAgent: entrada.userAgent ?? null,
    createdAt: creadoEn,
    prevHash,
    hash: calcularHash(llave, prevHash, entrada, creadoEn),
  });
  return manager.getRepository(AuditLog).save(fila);
}

/** Recorre toda la cadena y dice si alguna fila fue alterada. */
export async function verificarCadena(
  manager: EntityManager,
  llave: Buffer,
): Promise<{ valida: boolean; filaRota?: string }> {
  const filas = await manager.getRepository(AuditLog).find({ order: { id: 'ASC' } });
  let anterior: Buffer | null = null;
  for (const fila of filas) {
    const esperado = calcularHash(llave, anterior, fila, fila.createdAt);
    const previo = fila.prevHash ?? null;
    const enlazada =
      previo === null ? anterior === null : anterior !== null && previo.equals(anterior);
    if (!enlazada || !esperado.equals(fila.hash)) return { valida: false, filaRota: fila.id };
    anterior = fila.hash;
  }
  return { valida: true };
}

function ordenarClaves(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarClaves);
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([clave, v]) => [clave, ordenarClaves(v)]),
    );
  }
  return valor;
}
