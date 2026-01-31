import {
    Entity,
    Column,
    PrimaryColumn,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { ProductModifier } from './product-modifier.entity';
import { Product } from './product.entity';

@Entity('product_modifier_options')
export class ProductModifierOption {
    @PrimaryColumn('uuid')
    id: string;

    @ManyToOne(() => ProductModifier, (modifier) => modifier.options, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'modifier_id' })
    modifier: ProductModifier;

    @Column('uuid')
    modifier_id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    extra_price_bs: number;

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    extra_price_usd: number;

    @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'ingredient_product_id' })
    ingredient_product: Product | null;

    @Column({ type: 'uuid', nullable: true })
    ingredient_product_id: string | null;

    @Column({ type: 'numeric', precision: 18, scale: 3, nullable: true })
    qty_delta: number | null;

    @Column({ type: 'boolean', default: false })
    is_default: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;
}
