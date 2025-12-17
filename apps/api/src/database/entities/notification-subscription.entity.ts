import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { Profile } from './profile.entity';

@Entity('notification_subscriptions')
@Index(['store_id', 'user_id'])
@Index(['is_active'], { where: 'is_active = true' })
export class NotificationSubscription {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Profile;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  device_id: string;

  @Column({ type: 'text' })
  endpoint: string; // URL del push service

  @Column({ type: 'text' })
  p256dh_key: string; // Clave pública P256DH

  @Column({ type: 'text' })
  auth_key: string; // Clave de autenticación

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

