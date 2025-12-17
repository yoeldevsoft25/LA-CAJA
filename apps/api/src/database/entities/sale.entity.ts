import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Store } from './store.entity';
import { SaleItem } from './sale-item.entity';
import { Profile } from './profile.entity';
import { Customer } from './customer.entity';
import { InvoiceSeries } from './invoice-series.entity';

@Entity('sales')
export class Sale {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'uuid', nullable: true })
  cash_session_id: string | null;

  @Column({ type: 'timestamptz' })
  sold_at: Date;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  exchange_rate: number;

  @Column({ type: 'varchar', length: 20 })
  currency: 'BS' | 'USD' | 'MIXED';

  @Column({ type: 'jsonb' })
  totals: {
    subtotal_bs: number;
    subtotal_usd: number;
    discount_bs: number;
    discount_usd: number;
    total_bs: number;
    total_usd: number;
  };

  @Column({ type: 'jsonb' })
  payment: {
    method: string;
    split?: {
      cash_bs: number;
      cash_usd: number;
      pago_movil_bs: number;
      transfer_bs: number;
      other_bs: number;
    };
    cash_payment?: {
      received_usd: number; // Monto recibido en USD físico
      change_bs?: number; // Cambio dado en Bs
    };
    cash_payment_bs?: {
      received_bs: number; // Monto recibido en Bs físico
      change_bs?: number; // Cambio dado en Bs (redondeado)
    };
  };

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ type: 'uuid', nullable: true })
  sold_by_user_id: string | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sold_by_user_id' })
  sold_by_user: Profile | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => InvoiceSeries, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_series_id' })
  invoiceSeries: InvoiceSeries | null;

  @Column({ type: 'uuid', nullable: true })
  invoice_series_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  invoice_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  invoice_full_number: string | null; // Número completo: "A-001", "FAC-B-123", etc.

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items: SaleItem[];
}

