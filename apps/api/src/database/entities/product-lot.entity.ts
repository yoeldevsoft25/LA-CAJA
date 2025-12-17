import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Product } from './product.entity';
import { LotMovement } from './lot-movement.entity';

export type LotMovementType =
  | 'received'
  | 'sold'
  | 'expired'
  | 'damaged'
  | 'adjusted';

@Entity('product_lots')
@Index(['product_id'])
@Index(['expiration_date'], { where: 'expiration_date IS NOT NULL' })
@Index(['product_id', 'received_at'])
export class ProductLot {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('uuid')
  product_id: string;

  @Column({ type: 'varchar', length: 100 })
  lot_number: string;

  @Column({ type: 'int' })
  initial_quantity: number;

  @Column({ type: 'int' })
  remaining_quantity: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  unit_cost_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  unit_cost_usd: number;

  @Column({ type: 'date', nullable: true })
  expiration_date: Date | null;

  @Column({ type: 'timestamptz' })
  received_at: Date;

  @Column({ type: 'text', nullable: true })
  supplier: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;

  @OneToMany(() => LotMovement, (movement) => movement.lot)
  movements: LotMovement[];
}
