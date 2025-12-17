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
  | 'revenue'
  | 'profit'
  | 'customers'
  | 'products';
export type Trend = 'increasing' | 'decreasing' | 'stable';

@Entity('comparative_metrics')
@Index(['store_id'])
@Index(['metric_type'])
@Index(['current_period_start', 'current_period_end'])
export class ComparativeMetric {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  metric_type: MetricType;

  @Column({ type: 'date' })
  current_period_start: Date;

  @Column({ type: 'date' })
  current_period_end: Date;

  @Column({ type: 'date' })
  previous_period_start: Date;

  @Column({ type: 'date' })
  previous_period_end: Date;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  current_value: number;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  previous_value: number;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  change_amount: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  change_percentage: number;

  @Column({ type: 'varchar', length: 20 })
  trend: Trend;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  calculated_at: Date;
}
