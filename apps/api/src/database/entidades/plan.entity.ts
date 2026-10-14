import type { CodigoPlan } from '@doctrader/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Planes de licencia. Cada orden copia el precio, así que cambiarlo no afecta órdenes viejas. */
@Entity({ name: 'plans' })
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16, unique: true })
  code: CodigoPlan;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'duration_months', type: 'integer', nullable: true })
  durationMonths: number | null;

  @Column({ name: 'bonus_months', type: 'integer', default: 0 })
  bonusMonths: number;

  @Column({ name: 'duration_days', type: 'integer', nullable: true })
  durationDays: number | null;

  @Column({ name: 'price_usd_cents', type: 'integer' })
  priceUsdCents: number;

  @Column({ type: 'integer' })
  rank: number;

  @Column({ name: 'is_public', type: 'boolean' })
  isPublic: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
