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
import {
  AlertThreshold,
  AlertType,
  AlertSeverity,
} from './alert-threshold.entity';

export type EntityType =
  | 'sale'
  | 'product'
  | 'inventory'
  | 'customer'
  | 'debt'
  | 'purchase';

@Entity('real_time_alerts')
@Index(['store_id'])
@Index(['alert_type'])
@Index(['severity'])
@Index(['is_read', 'created_at'])
@Index(['created_at'])
export class RealTimeAlert {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => AlertThreshold, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'threshold_id' })
  threshold: AlertThreshold | null;

  @Column({ type: 'uuid', nullable: true })
  threshold_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  alert_type: AlertType;

  @Column({
    type: 'varchar',
    length: 20,
  })
  severity: AlertSeverity;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 100 })
  metric_name: string;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  current_value: number;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  threshold_value: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  entity_type: EntityType | null;

  @Column({ type: 'uuid', nullable: true })
  entity_id: string | null;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  read_at: Date | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'read_by' })
  read_by_user: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  read_by: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
