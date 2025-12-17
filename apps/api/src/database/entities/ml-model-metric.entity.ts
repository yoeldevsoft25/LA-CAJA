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

export type ModelType =
  | 'demand_prediction'
  | 'recommendation'
  | 'anomaly_detection';

@Entity('ml_model_metrics')
@Index(['store_id'])
@Index(['model_type', 'model_version'])
@Index(['evaluation_date'])
export class MLModelMetric {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  model_type: ModelType;

  @Column({ type: 'varchar', length: 50 })
  model_version: string;

  @Column({ type: 'varchar', length: 100 })
  metric_name: string;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  metric_value: number;

  @Column({ type: 'date' })
  evaluation_date: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
