import type { EstadoOrden, EstadoVerificacion, Moneda, Red, TipoOrden } from '@doctrader/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Orden de pago: copia el precio, la dirección y (en BTC) el precio del bitcoin al crearse, y vale una hora.
 * Los montos en cripto son `numeric(38,0)` en unidades base; TypeORM los entrega como texto.
 */
@Entity({ name: 'payment_orders' })
export class PaymentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `DTP-000123`: lo pone la base de datos con su secuencia. */
  @Column({ type: 'text', insert: false, update: false })
  number: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'trading_account_id', type: 'uuid' })
  tradingAccountId: string;

  @Column({ name: 'license_id', type: 'uuid' })
  licenseId: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ type: 'varchar', length: 16 })
  type: TipoOrden;

  @Column({ name: 'price_usd_cents', type: 'integer' })
  priceUsdCents: number;

  @Column({ name: 'credit_usd_cents', type: 'integer', default: 0 })
  creditUsdCents: number;

  @Column({ name: 'amount_usd_cents', type: 'integer' })
  amountUsdCents: number;

  @Column({ type: 'varchar', length: 8 })
  currency: Moneda;

  @Column({ type: 'varchar', length: 16 })
  network: Red;

  @Column({ name: 'deposit_address_id', type: 'uuid' })
  depositAddressId: string;

  @Column({ name: 'deposit_address', type: 'text' })
  depositAddress: string;

  @Column({ name: 'amount_base_units', type: 'numeric', precision: 38, scale: 0 })
  amountBaseUnits: string;

  @Column({ name: 'btc_usd_rate', type: 'numeric', precision: 18, scale: 2, nullable: true })
  btcUsdRate: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 16, default: 'PENDIENTE' })
  status: EstadoOrden;

  @Column({ name: 'tx_hash', type: 'text', nullable: true })
  txHash: string | null;

  @Column({ name: 'reported_at', type: 'timestamptz', nullable: true })
  reportedAt: Date | null;

  @Column({ name: 'verification_status', type: 'varchar', length: 32, nullable: true })
  verificationStatus: EstadoVerificacion | null;

  @Column({
    name: 'received_base_units',
    type: 'numeric',
    precision: 38,
    scale: 0,
    nullable: true,
  })
  receivedBaseUnits: string | null;

  @Column({ type: 'integer', nullable: true })
  confirmations: number | null;

  @Column({ name: 'tx_time', type: 'timestamptz', nullable: true })
  txTime: Date | null;

  @Column({ name: 'block_height', type: 'bigint', nullable: true })
  blockHeight: string | null;

  @Column({ name: 'sender_addresses', type: 'jsonb', nullable: true })
  senderAddresses: string[] | null;

  @Column({ name: 'verification_detail', type: 'jsonb', nullable: true })
  verificationDetail: Record<string, unknown> | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'approval_mode', type: 'varchar', length: 8, nullable: true })
  approvalMode: 'MANUAL' | 'AUTO' | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'commission_bp', type: 'integer', nullable: true })
  commissionBp: number | null;

  @Column({ name: 'commission_usd_cents', type: 'integer', nullable: true })
  commissionUsdCents: number | null;

  @Column({ name: 'commission_payout_id', type: 'uuid', nullable: true })
  commissionPayoutId: string | null;

  /** Programa de referidos: quién invitó al comprador y su comisión, fijados al aprobar (`docs/MODELO-DATOS.md`). */
  @Column({ name: 'referrer_id', type: 'uuid', nullable: true })
  referrerId: string | null;

  @Column({ name: 'referral_bp', type: 'integer', nullable: true })
  referralBp: number | null;

  @Column({ name: 'referral_usd_cents', type: 'integer', nullable: true })
  referralUsdCents: number | null;

  @Column({ name: 'referral_payout_id', type: 'uuid', nullable: true })
  referralPayoutId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
