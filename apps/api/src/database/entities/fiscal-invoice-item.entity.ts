import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { FiscalInvoice } from './fiscal-invoice.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('fiscal_invoice_items')
@Index(['fiscal_invoice_id'])
@Index(['product_id'])
export class FiscalInvoiceItem {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => FiscalInvoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fiscal_invoice_id' })
  fiscal_invoice: FiscalInvoice;

  @Column('uuid')
  fiscal_invoice_id: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('uuid')
  product_id: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variant_id: string | null;

  @Column({ type: 'varchar', length: 200 })
  product_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  product_code: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 3 })
  quantity: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_price_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_price_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  subtotal_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  subtotal_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  tax_amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  tax_amount_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_usd: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  tax_rate: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
