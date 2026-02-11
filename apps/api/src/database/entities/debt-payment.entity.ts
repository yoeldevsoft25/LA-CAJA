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

  // Tasa BCV usada para calcular amount_bs (auditoria)
  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  bcv_rate: number | null;

  // Tasa BCV de libro aplicada a CxC en este pago (auditoria)
  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  book_rate_bcv: number | null;

  // Diferencia cambiaria realizada en Bs (puede ser negativa)
  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  fx_gain_loss_bs: number | null;

  @Column({ type: 'varchar', length: 50 })
  method: string; // CASH_BS, CASH_USD, PAGO_MOVIL, TRANSFER, OTHER

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
