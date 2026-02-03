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

export type WhatsAppMessageType =
  | 'sale'
  | 'debt'
  | 'debt_reminder'
  | 'customer'
  | 'custom';

export type WhatsAppMessageStatus = 'pending' | 'sent' | 'failed' | 'retrying';

@Entity('whatsapp_message_queue')
@Index(['store_id', 'status'])
@Index(['store_id', 'message_type'])
@Index(['store_id', 'reference_id'])
@Index(['status', 'created_at'])
export class WhatsAppMessageQueue {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 20 })
  message_type: WhatsAppMessageType;

  @Column({ type: 'uuid', nullable: true })
  reference_id: string | null;

  @Column({ type: 'varchar', length: 20 })
  customer_phone: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: WhatsAppMessageStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'int', default: 3 })
  max_attempts: number;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_for: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  device_id: string | null;

  @Column({ type: 'bigint', nullable: true })
  seq: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
