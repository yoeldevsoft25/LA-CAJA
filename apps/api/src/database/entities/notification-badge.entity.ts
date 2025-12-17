import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { Profile } from './profile.entity';

@Entity('notification_badges')
@Index(['store_id', 'user_id'])
export class NotificationBadge {
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

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string | null; // NULL = total general

  @Column({ type: 'integer', default: 0 })
  unread_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_notification_at: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

