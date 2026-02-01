import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Store } from './store.entity';

@Entity('customers')
@Index(['store_id', 'email'], { where: 'email IS NOT NULL' })
@Index(['store_id', 'credit_limit'], {
  where: 'credit_limit IS NOT NULL AND credit_limit > 0',
})
export class Customer {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  document_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  /**
   * Maximum credit limit for FIAO purchases (in USD as reference currency)
   * NULL means no credit allowed, 0 means credit disabled
   */
  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  credit_limit: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  debt_cutoff_at: Date | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;
}
