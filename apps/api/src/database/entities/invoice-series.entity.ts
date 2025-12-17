import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Store } from './store.entity';
import { Sale } from './sale.entity';

@Entity('invoice_series')
@Index(['store_id'])
@Index(['store_id', 'is_active'], { where: 'is_active = true' })
export class InvoiceSeries {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 10 })
  series_code: string; // A, B, C, etc.

  @Column({ type: 'varchar', length: 100 })
  name: string; // "Serie Principal", "Serie Especial", etc.

  @Column({ type: 'varchar', length: 20, nullable: true })
  prefix: string | null; // "FAC", "TICK", etc.

  @Column({ type: 'int', default: 0 })
  current_number: number; // Último número usado

  @Column({ type: 'int', default: 1 })
  start_number: number; // Número inicial

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;

  @OneToMany(() => Sale, (sale) => sale.invoiceSeries)
  sales: Sale[];
}
