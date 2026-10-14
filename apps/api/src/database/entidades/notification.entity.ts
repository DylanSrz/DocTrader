import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const ESTADO_AVISO = {
  PENDIENTE: 'PENDIENTE',
  ENVIADA: 'ENVIADA',
  FALLIDA: 'FALLIDA',
} as const;
export type EstadoAviso = (typeof ESTADO_AVISO)[keyof typeof ESTADO_AVISO];

/** Bandeja de salida de correos y SMS. Ver `docs/MODELO-DATOS.md`. */
@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 8 })
  channel: 'EMAIL' | 'SMS';

  @Column({ type: 'text' })
  recipient: string;

  @Column({ type: 'text' })
  template: string;

  /** Datos para la plantilla. Nunca contraseñas ni enlaces de un solo uso: esos van cifrados en `secretEnc`. */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, string>;

  @Column({ name: 'secret_enc', type: 'bytea', nullable: true })
  secretEnc: Buffer | null;

  @Column({ name: 'dedupe_key', type: 'text', nullable: true, unique: true })
  dedupeKey: string | null;

  @Column({ type: 'varchar', length: 16, default: ESTADO_AVISO.PENDIENTE })
  status: EstadoAviso;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt: Date;

  @Column({ name: 'provider_message_id', type: 'text', nullable: true })
  providerMessageId: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
