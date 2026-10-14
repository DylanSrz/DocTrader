import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Registro de auditoría. La base de datos impide cambiar o borrar filas, y cada fila lleva el hash de la
 * anterior (ver `docs/SEGURIDAD.md` §12). Solo se escribe con `AuditoriaService`.
 */
@Entity({ name: 'audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_role', type: 'varchar', length: 16, nullable: true })
  actorRole: string | null;

  @Column({ type: 'text' })
  action: string;

  @Column({ name: 'target_type', type: 'text', nullable: true })
  targetType: string | null;

  @Column({ name: 'target_id', type: 'text', nullable: true })
  targetId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'prev_hash', type: 'bytea', nullable: true })
  prevHash: Buffer | null;

  @Column({ type: 'bytea' })
  hash: Buffer;
}
