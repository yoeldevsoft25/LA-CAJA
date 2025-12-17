import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { Profile } from './profile.entity';

export type NotificationType = 'alert' | 'info' | 'warning' | 'success' | 'system';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type EntityType = 'sale' | 'product' | 'inventory' | 'customer' | 'debt' | 'purchase' | 'alert';

@Entity('notifications')
@Index(['store_id'])
@Index(['user_id'])
@Index(['notification_type'])
@Index(['category'])
@Index(['is_read', 'created_at'])
@Index(['is_delivered'])
@Index(['created_at'])
@Index(['entity_type', 'entity_id'])
export class Notification {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  notification_type: NotificationType;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  action_url: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  action_label: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'normal',
  })
  priority: NotificationPriority;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  severity: NotificationSeverity | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  entity_type: EntityType | null;

  @Column({ type: 'uuid', nullable: true })
  entity_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  read_at: Date | null;

  @Column({ type: 'boolean', default: false })
  is_delivered: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  delivery_channels: string[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

