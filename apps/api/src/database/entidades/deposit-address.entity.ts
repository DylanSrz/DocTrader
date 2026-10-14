import type { EstadoDireccion, Moneda, Red } from '@doctrader/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Direcciones donde los clientes pagan. Una dirección nueva espera 24 horas antes de activarse
 * (ver `docs/SEGURIDAD.md` §5).
 */
@Entity({ name: 'deposit_addresses' })
export class DepositAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 8 })
  currency: Moneda;

  @Column({ type: 'varchar', length: 16 })
  network: Red;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 16 })
  status: EstadoDireccion;

  @Column({ name: 'activates_at', type: 'timestamptz' })
  activatesAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
