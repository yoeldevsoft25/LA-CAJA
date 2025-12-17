import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Store } from './store.entity';

export enum CashSessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Entity('cash_sessions')
export class CashSession {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'uuid', nullable: true })
  opened_by: string | null;

  @Column({ type: 'timestamptz' })
  opened_at: Date;

  @Column({ type: 'uuid', nullable: true })
  closed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  opening_amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  opening_amount_usd: number;

  @Column({ type: 'jsonb', nullable: true })
  expected: {
    cash_bs: number;
    cash_usd: number;
    by_method?: Record<string, number>;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  counted: {
    cash_bs: number;
    cash_usd: number;
  } | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
