import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { Supplier } from './supplier.entity';
import { Warehouse } from './warehouse.entity';
import { Profile } from './profile.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

export type PurchaseOrderStatus =
  | 'draft'
  | 'sent'
  | 'confirmed'
  | 'partial'
  | 'completed'
  | 'cancelled';

@Entity('purchase_orders')
@Index(['store_id'])
@Index(['supplier_id'])
@Index(['warehouse_id'], { where: 'warehouse_id IS NOT NULL' })
@Index(['store_id', 'status'])
@Index(['store_id', 'order_number'], { unique: true })
export class PurchaseOrder {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  order_number: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column('uuid')
  supplier_id: string;

  @ManyToOne(() => Warehouse, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse | null;

  @Column({ type: 'uuid', nullable: true })
  warehouse_id: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status: PurchaseOrderStatus;

  @Column({ type: 'date', nullable: true })
  expected_delivery_date: Date | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requested_by' })
  requester: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  requested_by: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  requested_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmed_at: Date | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'received_by' })
  receiver: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  received_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  received_at: Date | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_amount_usd: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchase_order)
  items: PurchaseOrderItem[];
}
