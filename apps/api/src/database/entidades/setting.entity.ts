import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type ValorJson =
  string | number | boolean | null | ValorJson[] | { [clave: string]: ValorJson };

/** Ajustes editables desde el panel (clave y valor JSON). Valores iniciales en la semilla. */
@Entity({ name: 'settings' })
export class Setting {
  @PrimaryColumn({ type: 'text' })
  key: string;

  @Column({ type: 'jsonb' })
  value: ValorJson;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
