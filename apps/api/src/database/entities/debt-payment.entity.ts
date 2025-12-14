import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Store } from './store.entity';
import { Debt } from './debt.entity';

@Entity('debt_payments')
export class DebtPayment {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Debt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debt_id' })
  debt: Debt;

  @Column('uuid')
  debt_id: string;

  @Column({ type: 'timestamptz' })
  paid_at: Date;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount_usd: number;

  @Column({ type: 'varchar', length: 50 })
  method: string; // CASH_BS, CASH_USD, PAGO_MOVIL, TRANSFER, OTHER

  @Column({ type: 'text', nullable: true })
  note: string | null;
}

