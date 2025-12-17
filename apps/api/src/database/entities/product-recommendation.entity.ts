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

export type RecommendationType = 'collaborative' | 'content_based' | 'hybrid';

@Entity('product_recommendations')
@Index(['store_id'])
@Index(['source_product_id'])
@Index(['recommended_product_id'])
@Index(['recommendation_type'])
@Index(
  [
    'store_id',
    'source_product_id',
    'recommended_product_id',
    'recommendation_type',
  ],
  {
    unique: true,
  },
)
export class ProductRecommendation {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'source_product_id' })
  source_product: Product | null;

  @Column({ type: 'uuid', nullable: true })
  source_product_id: string | null; // NULL = recomendaciones generales

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recommended_product_id' })
  recommended_product: Product;

  @Column('uuid')
  recommended_product_id: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'collaborative',
  })
  recommendation_type: RecommendationType;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  score: number; // 0-100

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
