import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ProductLot, LotMovementType } from './product-lot.entity';
import { Sale } from './sale.entity';

@Entity('lot_movements')
@Index(['lot_id'])
@Index(['sale_id'], { where: 'sale_id IS NOT NULL' })
@Index(['movement_type'])
export class LotMovement {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => ProductLot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lot_id' })
  lot: ProductLot;

  @Column('uuid')
  lot_id: string;

  @Column({ type: 'varchar', length: 20 })
  movement_type: LotMovementType;

  @Column({ type: 'int' })
  qty_delta: number;

  @Column({ type: 'timestamptz' })
  happened_at: Date;

  @ManyToOne(() => Sale, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  @Column({ type: 'uuid', nullable: true })
  sale_id: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;
}

