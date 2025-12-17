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
import { Product } from './product.entity';

@Entity('demand_predictions')
@Index(['store_id'])
@Index(['product_id'])
@Index(['predicted_date'])
@Index(['store_id', 'product_id', 'predicted_date'], { unique: true })
export class DemandPrediction {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('uuid')
  product_id: string;

  @Column({ type: 'date' })
  predicted_date: Date;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  predicted_quantity: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  confidence_score: number; // 0-100

  @Column({ type: 'varchar', length: 50, default: 'v1.0' })
  model_version: string;

  @Column({ type: 'jsonb', nullable: true })
  features: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
