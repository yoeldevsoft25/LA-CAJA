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

export type AnomalyType =
  | 'sale_amount'
  | 'sale_frequency'
  | 'product_movement'
  | 'inventory_level'
  | 'price_deviation'
  | 'customer_behavior'
  | 'payment_pattern';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type EntityType =
  | 'sale'
  | 'product'
  | 'customer'
  | 'inventory'
  | 'payment';

@Entity('detected_anomalies')
@Index(['store_id'])
@Index(['anomaly_type'])
@Index(['entity_type', 'entity_id'])
@Index(['severity'])
@Index(['resolved_at'])
@Index(['detected_at'])
export class DetectedAnomaly {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  anomaly_type: AnomalyType;

  @Column({ type: 'varchar', length: 50 })
  entity_type: EntityType;

  @Column({ type: 'uuid', nullable: true })
  entity_id: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'medium',
  })
  severity: AnomalySeverity;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  score: number; // 0-100

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  detected_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolved_by_user: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  resolved_by: string | null;

  @Column({ type: 'text', nullable: true })
  resolution_note: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
