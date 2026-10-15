import type { TipoConsentimiento } from '@doctrader/shared';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Prueba de cada autorización del cliente (Ley 1581): qué aceptó, qué versión, cuándo y desde dónde. */
@Entity({ name: 'consents' })
export class Consent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  type: TipoConsentimiento;

  @Column({ name: 'document_version', type: 'text', nullable: true })
  documentVersion: string | null;

  /** El texto exacto que aceptó (nulo en mercadeo, que no tiene texto propio). */
  @Column({ name: 'legal_document_id', type: 'uuid', nullable: true })
  legalDocumentId: string | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', default: () => 'now()' })
  acceptedAt: Date;

  @Column({ type: 'text', nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
