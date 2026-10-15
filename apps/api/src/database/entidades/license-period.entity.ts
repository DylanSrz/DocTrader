import type { TipoPeriodo } from '@doctrader/shared';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Historial de lo que se pagó: cada orden aprobada crea un periodo (y un admin puede extender días). */
@Entity({ name: 'license_periods' })
export class LicensePeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'license_id', type: 'uuid' })
  licenseId: string;

  @Column({ name: 'payment_order_id', type: 'uuid', nullable: true, unique: true })
  paymentOrderId: string | null;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ type: 'varchar', length: 24 })
  kind: TipoPeriodo;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  /** El mes de obsequio de la semestral, para pintarlo en verde limón. */
  @Column({ name: 'bonus_months', type: 'integer', default: 0 })
  bonusMonths: number;

  /** Motivo de los días que extiende un admin. */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
