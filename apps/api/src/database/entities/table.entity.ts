import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { Store } from './store.entity';
import { Order } from './order.entity';

export type TableStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'cleaning'
  | 'out_of_service';

@Entity('tables')
@Index(['store_id'])
@Index(['store_id', 'status'])
@Index(['current_order_id'], { where: 'current_order_id IS NOT NULL' })
export class Table {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 20 })
  table_number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column({ type: 'varchar', length: 20, default: 'available' })
  status: TableStatus;

  @OneToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'current_order_id' })
  currentOrder: Order | null;

  @Column({ type: 'uuid', nullable: true })
  current_order_id: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;
}
