import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Store } from './store.entity';

@Entity('license_usage')
@Unique(['store_id', 'metric', 'period_end']) // Ensure unique metric per period
export class LicenseUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  store_id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('text')
  metric: string; // 'products_count', 'users_count', 'sales_current_month'

  @Column('int', { default: 0 })
  used: number;

  @Column('timestamptz', { nullable: true })
  period_start: Date;

  @Column('timestamptz', { nullable: true })
  period_end: Date; // Null for breakdown metrics like 'products_count' that aren't periodic

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
