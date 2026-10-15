import type { TipoAdjunto } from '@doctrader/shared';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const PROPOSITO_ARCHIVO = {
  TICKET_ADJUNTO: 'TICKET_ADJUNTO',
  FOTO_DOCUMENTO: 'FOTO_DOCUMENTO',
} as const;
export type PropositoArchivo = (typeof PROPOSITO_ARCHIVO)[keyof typeof PROPOSITO_ARCHIVO];

/** Un archivo en el almacenamiento privado (R2), guardado con un nombre aleatorio (`docs/MODELO-DATOS.md` §3.6). */
@Entity({ name: 'files' })
export class StoredFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId: string;

  @Column({ type: 'varchar', length: 20 })
  purpose: PropositoArchivo;

  @Column({ name: 'ticket_message_id', type: 'uuid', nullable: true })
  ticketMessageId: string | null;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey: string;

  /** El nombre que se muestra y con el que se descarga, ya limpio. */
  @Column({ name: 'original_name', type: 'text' })
  originalName: string;

  @Column({ type: 'varchar', length: 32 })
  mime: TipoAdjunto;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ type: 'bytea' })
  sha256: Buffer;

  @Column({ name: 'is_encrypted', type: 'boolean', default: false })
  isEncrypted: boolean;

  /** Un adjunto que nadie usó se borra después de esta fecha. */
  @Column({ name: 'delete_after', type: 'timestamptz', nullable: true })
  deleteAfter: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
