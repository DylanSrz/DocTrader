import type { TipoDocumentoLegal } from '@doctrader/shared';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Una versión publicada de un texto legal. La base de datos no deja cambiarla ni borrarla. */
@Entity({ name: 'legal_documents' })
export class LegalDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  type: TipoDocumentoLegal;

  @Column({ type: 'integer' })
  version: number;

  @Column({ name: 'content_md', type: 'text' })
  contentMd: string;

  @Column({ name: 'published_at', type: 'timestamptz', default: () => 'now()' })
  publishedAt: Date;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;
}
