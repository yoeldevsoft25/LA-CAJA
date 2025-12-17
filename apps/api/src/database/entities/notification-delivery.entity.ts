import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationSubscription } from './notification-subscription.entity';

export type DeliveryChannel = 'push' | 'websocket' | 'in_app' | 'email';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed';

@Entity('notification_deliveries')
@Index(['notification_id'])
@Index(['subscription_id'])
@Index(['status'])
@Index(['channel'])
export class NotificationDelivery {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Notification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;

  @Column('uuid')
  notification_id: string;

  @ManyToOne(() => NotificationSubscription, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'subscription_id' })
  subscription: NotificationSubscription | null;

  @Column({ type: 'uuid', nullable: true })
  subscription_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  channel: DeliveryChannel;

  @Column({ type: 'varchar', length: 20 })
  status: DeliveryStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
