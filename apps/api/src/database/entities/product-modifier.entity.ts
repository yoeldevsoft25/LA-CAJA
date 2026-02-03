import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { ProductModifierOption } from './product-modifier-option.entity';

@Entity('product_modifiers')
export class ProductModifier {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('uuid')
  product_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'optional' })
  type: 'optional' | 'interchangeable' | 'required';

  @Column({ type: 'boolean', default: false })
  is_multiple: boolean;

  @Column({ type: 'int', default: 0 })
  min_options: number;

  @Column({ type: 'int', nullable: true })
  max_options: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @OneToMany(() => ProductModifierOption, (option) => option.modifier, {
    cascade: true,
  })
  options: ProductModifierOption[];
}
