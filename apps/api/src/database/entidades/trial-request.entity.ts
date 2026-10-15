import type { EstadoSolicitudPrueba } from '@doctrader/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Una coincidencia con una prueba anterior: lo que bloqueó la solicitud o una señal para el admin. */
export interface Coincidencia {
  tipo: string;
  /** Una frase para el admin ("Mismo dispositivo que la prueba de …"). */
  texto: string;
  /** La solicitud anterior con la que coincide, si todavía existe. */
  solicitudId?: string | null;
}

/** Una solicitud de licencia de prueba (`docs/MODELO-DATOS.md` §3.5). */
@Entity({ name: 'trial_requests' })
export class TrialRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'trading_account_id', type: 'uuid' })
  tradingAccountId: string;

  @Column({ type: 'varchar', length: 16 })
  status: EstadoSolicitudPrueba;

  @Column({ name: 'block_reasons', type: 'jsonb', default: () => `'[]'::jsonb` })
  blockReasons: Coincidencia[];

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  signals: Coincidencia[];

  @Column({ name: 'device_hash', type: 'bytea', nullable: true })
  deviceHash: Buffer | null;

  @Column({ type: 'text', nullable: true })
  ip: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @Column({ name: 'payment_order_id', type: 'uuid', nullable: true })
  paymentOrderId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
