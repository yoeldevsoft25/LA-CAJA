import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('recipe_ingredients')
export class RecipeIngredient {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_product_id' })
  recipe_product: Product;

  @Column('uuid')
  recipe_product_id: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ingredient_product_id' })
  ingredient_product: Product;

  @Column('uuid')
  ingredient_product_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 3 })
  qty: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
