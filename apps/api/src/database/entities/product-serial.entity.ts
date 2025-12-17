import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';
import { Sale } from './sale.entity';
import { SaleItem } from './sale-item.entity';

export type SerialStatus = 'available' | 'sold' | 'returned' | 'damaged';

@Entity('product_serials')
@Index(['product_id'])
@Index(['status'])
@Index(['sale_id'], { where: 'sale_id IS NOT NULL' })
@Index(['sale_item_id'], { where: 'sale_item_id IS NOT NULL' })
@Index(['product_id', 'status'], { where: "status = 'available'" })
export class ProductSerial {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('uuid')
  product_id: string;

  @Column({ type: 'varchar', length: 200 })
  serial_number: string;

  @Column({ type: 'varchar', length: 20, default: 'available' })
  status: SerialStatus;

  @ManyToOne(() => Sale, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  @Column({ type: 'uuid', nullable: true })
  sale_id: string | null;

  @ManyToOne(() => SaleItem, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sale_item_id' })
  saleItem: SaleItem | null;

  @Column({ type: 'uuid', nullable: true })
  sale_item_id: string | null;

  @Column({ type: 'timestamptz' })
  received_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sold_at: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;
}

