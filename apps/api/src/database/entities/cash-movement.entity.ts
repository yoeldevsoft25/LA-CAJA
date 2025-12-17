import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Store } from './store.entity';
import { Shift } from './shift.entity';
import { CashSession } from './cash-session.entity';
import { Profile } from './profile.entity';

export enum CashMovementType {
  ENTRY = 'entry',
  EXIT = 'exit',
}

@Entity('cash_movements')
@Index(['store_id', 'created_at'])
@Index(['shift_id'], { where: 'shift_id IS NOT NULL' })
@Index(['cash_session_id'], { where: 'cash_session_id IS NOT NULL' })
@Index(['movement_type'])
@Index(['created_by'])
export class CashMovement {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Shift, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift | null;

  @Column({ type: 'uuid', nullable: true })
  shift_id: string | null;

  @ManyToOne(() => CashSession, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cash_session_id' })
  cashSession: CashSession | null;

  @Column({ type: 'uuid', nullable: true })
  cash_session_id: string | null;

  @Column({
    type: 'varchar',
    length: 20,
  })
  movement_type: CashMovementType;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount_usd: number;

  @Column({ type: 'varchar', length: 100 })
  reason: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => Profile)
  @JoinColumn({ name: 'created_by' })
  creator: Profile;

  @Column('uuid')
  created_by: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;
}
