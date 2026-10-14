import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const PROPOSITO_ENLACE = {
  VERIFICAR_CORREO: 'VERIFY_EMAIL',
  RESTABLECER_CONTRASENA: 'RESET_PASSWORD',
  CAMBIAR_CORREO: 'CHANGE_EMAIL',
} as const;
export type PropositoEnlace = (typeof PROPOSITO_ENLACE)[keyof typeof PROPOSITO_ENLACE];

/** Enlaces de un solo uso (verificar correo, restablecer contraseña). Solo se guarda el hash del enlace. */
@Entity({ name: 'auth_tokens' })
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  purpose: PropositoEnlace;

  @Column({ name: 'token_hash', type: 'bytea', unique: true })
  tokenHash: Buffer;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
