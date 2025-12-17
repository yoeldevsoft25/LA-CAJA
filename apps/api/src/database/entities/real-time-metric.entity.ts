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

export type MetricType =
  | 'sales'
  | 'inventory'
  | 'revenue'
  | 'profit'
  | 'customers'
  | 'products'
  | 'debt'
  | 'purchases';

export type PeriodType = 'current' | 'hour' | 'day' | 'week' | 'month';

@Entity('real_time_metrics')
@Index(['store_id'])
@Index(['metric_type'])
@Index(['period_start', 'period_end'])
@Index(['created_at'])
export class RealTimeMetric {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  metric_type: MetricType;

  @Column({ type: 'varchar', length: 100 })
  metric_name: string;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  metric_value: number;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  previous_value: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  change_percentage: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'current',
  })
  period_type: PeriodType;

  @Column({ type: 'timestamptz' })
  period_start: Date;

  @Column({ type: 'timestamptz' })
  period_end: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
