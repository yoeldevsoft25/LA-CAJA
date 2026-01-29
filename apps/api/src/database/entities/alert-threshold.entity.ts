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

export type AlertType =
  | 'stock_low'
  | 'sale_anomaly'
  | 'revenue_drop'
  | 'revenue_spike'
  | 'inventory_high'
  | 'debt_overdue'
  | 'product_expiring'
  | 'custom';

export type ComparisonOperator =
  | 'less_than'
  | 'greater_than'
  | 'equals'
  | 'not_equals';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

@Entity('alert_thresholds')
@Index(['store_id'])
@Index(['alert_type'])
@Index(['store_id', 'is_active'], { where: 'is_active = true' })
export class AlertThreshold {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  alert_type: AlertType;

  @Column({ type: 'varchar', length: 100 })
  metric_name: string;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  threshold_value: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'less_than',
  })
  comparison_operator: ComparisonOperator;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'medium',
  })
  severity: AlertSeverity;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'jsonb', nullable: true })
  notification_channels: string[] | null; // ['email', 'push', 'in_app']

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
