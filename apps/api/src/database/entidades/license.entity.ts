import type { EstadoLicencia } from '@doctrader/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** La licencia de una cuenta de trading (una por cuenta). Sus fechas salen de los periodos aprobados. */
@Entity({ name: 'licenses' })
export class License {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trading_account_id', type: 'uuid', unique: true })
  tradingAccountId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Plan del periodo vigente; nulo mientras no se haya pagado nada. */
  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @Column({ type: 'varchar', length: 16, default: 'PENDIENTE_PAGO' })
  status: EstadoLicencia;

  @Column({ name: 'is_trial', type: 'boolean', default: false })
  isTrial: boolean;

  @Column({ name: 'trial_started_at', type: 'timestamptz', nullable: true })
  trialStartedAt: Date | null;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'grace_ends_at', type: 'timestamptz', nullable: true })
  graceEndsAt: Date | null;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt: Date | null;

  @Column({ name: 'suspended_by', type: 'uuid', nullable: true })
  suspendedBy: string | null;

  @Column({ name: 'suspension_reason', type: 'text', nullable: true })
  suspensionReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
