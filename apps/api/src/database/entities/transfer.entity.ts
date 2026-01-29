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
import { Warehouse } from './warehouse.entity';
import { Profile } from './profile.entity';
import { TransferItem } from './transfer-item.entity';

export type TransferStatus =
  | 'pending'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

@Entity('transfers')
@Index(['store_id'])
@Index(['from_warehouse_id'])
@Index(['to_warehouse_id'])
@Index(['store_id', 'status'])
@Index(['store_id', 'transfer_number'])
export class Transfer {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  transfer_number: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'from_warehouse_id' })
  from_warehouse: Warehouse;

  @Column('uuid')
  from_warehouse_id: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'to_warehouse_id' })
  to_warehouse: Warehouse;

  @Column('uuid')
  to_warehouse_id: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: TransferStatus;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requested_by' })
  requester: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  requested_by: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  requested_at: Date;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'shipped_by' })
  shipper: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  shipped_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  shipped_at: Date | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'received_by' })
  receiver: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  received_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  received_at: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  driver_name: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vehicle_plate: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tracking_number: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  shipping_cost: number;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  priority: 'low' | 'normal' | 'high' | 'urgent';

  @Column({ type: 'timestamptz', nullable: true })
  expected_arrival: Date | null;

  @OneToMany(() => TransferItem, (item) => item.transfer)
  items: TransferItem[];
}
