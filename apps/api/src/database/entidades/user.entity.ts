import { ESTADO_USUARIO, type EstadoUsuario, type Rol } from '@doctrader/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Clientes y administradores. Ver `docs/MODELO-DATOS.md` §3.1. */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  role: Rol;

  @Column({ type: 'varchar', length: 16, default: ESTADO_USUARIO.ACTIVO })
  status: EstadoUsuario;

  @Column({ name: 'full_name', type: 'text' })
  fullName: string;

  @Column({ name: 'cedula_enc', type: 'bytea', nullable: true })
  cedulaEnc: Buffer | null;

  @Column({ name: 'cedula_hmac', type: 'bytea', nullable: true, unique: true })
  cedulaHmac: Buffer | null;

  @Column({ name: 'cedula_last4', type: 'char', length: 4, nullable: true })
  cedulaLast4: string | null;

  /** País que expidió el documento (`cedula_*` guarda su número, de cualquier tipo). */
  @Column({ name: 'document_country', type: 'char', length: 2, nullable: true })
  documentCountry: string | null;

  @Column({ name: 'document_type', type: 'varchar', length: 16, nullable: true })
  documentType: string | null;

  @Column({ type: 'citext', unique: true })
  email: string;

  @Column({ name: 'email_canonical', type: 'citext', unique: true })
  emailCanonical: string;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ name: 'phone_e164', type: 'text', nullable: true, unique: true })
  phoneE164: string | null;

  @Column({ name: 'phone_verified_at', type: 'timestamptz', nullable: true })
  phoneVerifiedAt: Date | null;

  /** Nulo hasta que la persona crea su contraseña (los admins iniciales entran por un enlace). */
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash: string | null;

  @Column({ name: 'totp_secret_enc', type: 'bytea', nullable: true })
  totpSecretEnc: Buffer | null;

  @Column({ name: 'totp_enabled_at', type: 'timestamptz', nullable: true })
  totpEnabledAt: Date | null;

  @Column({ name: 'marketing_opt_in', type: 'boolean', default: false })
  marketingOptIn: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
