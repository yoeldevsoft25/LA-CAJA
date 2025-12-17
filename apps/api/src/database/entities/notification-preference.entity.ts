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

@Entity('notification_preferences')
@Index(['store_id', 'user_id'])
@Index(['category'])
export class NotificationPreference {
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

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', default: '["in_app"]' })
  channels: string[]; // ['push', 'websocket', 'in_app', 'email']

  @Column({ type: 'time', nullable: true })
  quiet_hours_start: string | null; // Formato HH:MM

  @Column({ type: 'time', nullable: true })
  quiet_hours_end: string | null; // Formato HH:MM

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

