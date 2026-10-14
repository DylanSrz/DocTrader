import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Perfil del socio desarrollador: su % de comisión. Ver `docs/MODELO-DATOS.md` §3.7. */
@Entity({ name: 'partner_profiles' })
export class PartnerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  /** Puntos básicos: 1000 = 10 %. */
  @Column({ name: 'commission_bp', type: 'integer' })
  commissionBp: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
