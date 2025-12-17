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

@Entity('sales_heatmap')
@Index(['store_id'])
@Index(['date'])
@Index(['hour'])
@Index(['day_of_week'])
@Index(['store_id', 'date', 'hour'], { unique: true })
export class SalesHeatmap {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'integer' })
  hour: number; // 0-23

  @Column({ type: 'integer' })
  day_of_week: number; // 0-6 (0 = Domingo)

  @Column({ type: 'integer', default: 0 })
  sales_count: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_amount_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  avg_ticket_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  avg_ticket_usd: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
