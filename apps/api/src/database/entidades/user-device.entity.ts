import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Navegadores desde los que ha entrado cada usuario, para avisar de ingresos desde uno nuevo. */
@Entity({ name: 'user_devices' })
export class UserDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'device_hash', type: 'bytea' })
  deviceHash: Buffer;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'last_ip', type: 'text', nullable: true })
  lastIp: string | null;

  @Column({ name: 'first_seen_at', type: 'timestamptz', default: () => 'now()' })
  firstSeenAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'now()' })
  lastSeenAt: Date;
}
