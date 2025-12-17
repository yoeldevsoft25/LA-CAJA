import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Store } from './store.entity';
import { Profile } from './profile.entity';
import { ShiftCut } from './shift-cut.entity';

export enum ShiftStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

@Entity('shifts')
@Index(['store_id', 'opened_at'])
@Index(['cashier_id'])
@Index(['status'], { where: "status = 'open'" })
export class Shift {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Profile)
  @JoinColumn({ name: 'cashier_id' })
  cashier: Profile;

  @Column('uuid')
  cashier_id: string;

  @Column({ type: 'timestamptz' })
  opened_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  opening_amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  opening_amount_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  closing_amount_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  closing_amount_usd: number | null;

  @Column({ type: 'jsonb', nullable: true })
  expected_totals: {
    cash_bs: number;
    cash_usd: number;
    pago_movil_bs: number;
    transfer_bs: number;
    other_bs: number;
    total_bs: number;
    total_usd: number;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  counted_totals: {
    cash_bs: number;
    cash_usd: number;
    pago_movil_bs: number;
    transfer_bs: number;
    other_bs: number;
  } | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  difference_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  difference_usd: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ShiftStatus.OPEN,
  })
  status: ShiftStatus;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @OneToMany(() => ShiftCut, (cut) => cut.shift)
  cuts: ShiftCut[];
}
