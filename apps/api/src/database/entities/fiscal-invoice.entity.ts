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
import { Sale } from './sale.entity';
import { Customer } from './customer.entity';
import { InvoiceSeries } from './invoice-series.entity';
import { Profile } from './profile.entity';
import { FiscalInvoiceItem } from './fiscal-invoice-item.entity';

export type FiscalInvoiceType = 'invoice' | 'credit_note' | 'debit_note';
export type FiscalInvoiceStatus = 'draft' | 'issued' | 'cancelled' | 'rejected';

@Entity('fiscal_invoices')
@Index(['store_id'])
@Index(['sale_id'], { where: 'sale_id IS NOT NULL' })
@Index(['customer_id'], { where: 'customer_id IS NOT NULL' })
@Index(['store_id', 'status'])
@Index(['store_id', 'invoice_number'], { unique: true })
@Index(['store_id', 'issued_at'], { where: 'issued_at IS NOT NULL' })
export class FiscalInvoice {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Sale, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  @Column({ type: 'uuid', nullable: true })
  sale_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  invoice_number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fiscal_number: string | null;

  @ManyToOne(() => InvoiceSeries, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_series_id' })
  invoice_series: InvoiceSeries | null;

  @Column({ type: 'uuid', nullable: true })
  invoice_series_id: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'invoice',
  })
  invoice_type: FiscalInvoiceType;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status: FiscalInvoiceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  issued_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  // Información del emisor
  @Column({ type: 'varchar', length: 200 })
  issuer_name: string;

  @Column({ type: 'varchar', length: 50 })
  issuer_tax_id: string;

  @Column({ type: 'text', nullable: true })
  issuer_address: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  issuer_phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  issuer_email: string | null;

  // Información del cliente
  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  customer_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  customer_tax_id: string | null;

  @Column({ type: 'text', nullable: true })
  customer_address: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  customer_phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customer_email: string | null;

  // Totales
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  subtotal_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  subtotal_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  tax_amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  tax_amount_usd: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  tax_rate: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  exchange_rate: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'BS',
  })
  currency: 'BS' | 'USD' | 'MIXED';

  // Información fiscal
  @Column({ type: 'varchar', length: 100, nullable: true })
  fiscal_control_code: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fiscal_authorization_number: string | null;

  @Column({ type: 'text', nullable: true })
  fiscal_qr_code: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => FiscalInvoiceItem, (item) => item.fiscal_invoice)
  items: FiscalInvoiceItem[];
}
