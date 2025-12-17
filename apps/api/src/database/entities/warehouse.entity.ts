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
import { WarehouseStock } from './warehouse-stock.entity';
import { Transfer } from './transfer.entity';

@Entity('warehouses')
@Index(['store_id'])
@Index(['store_id', 'is_active'], { where: 'is_active = true' })
@Index(['store_id', 'is_default'], { where: 'is_default = true' })
export class Warehouse {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => WarehouseStock, (stock) => stock.warehouse)
  stock: WarehouseStock[];

  @OneToMany(() => Transfer, (transfer) => transfer.from_warehouse)
  outgoing_transfers: Transfer[];

  @OneToMany(() => Transfer, (transfer) => transfer.to_warehouse)
  incoming_transfers: Transfer[];
}
