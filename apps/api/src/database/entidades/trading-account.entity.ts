import type { EstadoConexion, NivelRiesgo } from '@doctrader/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Una cuenta de trading de un cliente. Las contraseñas van cifradas campo por campo y solo los admins las ven
 * (`docs/SEGURIDAD.md` §4). Ver `docs/MODELO-DATOS.md` §3.3.
 */
@Entity({ name: 'trading_accounts' })
export class TradingAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'holder_name', type: 'text' })
  holderName: string;

  @Column({ type: 'text' })
  broker: string;

  @Column({ type: 'text' })
  server: string;

  @Column({ name: 'account_number', type: 'text' })
  accountNumber: string;

  /** Huella de broker + servidor + número normalizados: una cuenta no puede estar en dos clientes. */
  @Column({ name: 'account_key_hmac', type: 'bytea' })
  accountKeyHmac: Buffer;

  @Column({ name: 'account_number_hmac', type: 'bytea' })
  accountNumberHmac: Buffer;

  @Column({ name: 'master_password_enc', type: 'bytea', nullable: true, select: false })
  masterPasswordEnc: Buffer | null;

  @Column({ name: 'investor_password_enc', type: 'bytea', nullable: true, select: false })
  investorPasswordEnc: Buffer | null;

  @Column({ name: 'passwords_purged_at', type: 'timestamptz', nullable: true })
  passwordsPurgedAt: Date | null;

  @Column({ name: 'connection_status', type: 'varchar', length: 16, default: 'SIN_LICENCIA' })
  connectionStatus: EstadoConexion;

  /** Desde cuándo está en el estado de conexión actual. Lo mantiene un disparador de la base de datos. */
  @Column({
    name: 'connection_changed_at',
    type: 'timestamptz',
    insert: false,
    update: false,
    default: () => 'now()',
  })
  connectionChangedAt: Date;

  @Column({ name: 'connected_at', type: 'timestamptz', nullable: true })
  connectedAt: Date | null;

  @Column({ name: 'connected_by', type: 'uuid', nullable: true })
  connectedBy: string | null;

  @Column({ name: 'disconnected_at', type: 'timestamptz', nullable: true })
  disconnectedAt: Date | null;

  @Column({ name: 'disconnected_by', type: 'uuid', nullable: true })
  disconnectedBy: string | null;

  @Column({ name: 'recommended_capital_usd_cents', type: 'integer', nullable: true })
  recommendedCapitalUsdCents: number | null;

  @Column({ name: 'risk_level', type: 'varchar', length: 8, nullable: true })
  riskLevel: NivelRiesgo | null;

  /** Durante la prueba no se pueden cambiar broker, servidor ni número. */
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ name: 'internal_notes', type: 'text', nullable: true, select: false })
  internalNotes: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
