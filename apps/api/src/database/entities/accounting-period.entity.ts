import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { Profile } from './profile.entity';

export enum AccountingPeriodStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  LOCKED = 'locked', // Cerrado y bloqueado (no se puede reabrir fácilmente)
}

@Entity('accounting_periods')
@Index(['store_id'])
@Index(['period_start', 'period_end'])
@Index(['status'])
export class AccountingPeriod {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 20 })
  period_code: string; // Formato: YYYY-MM o YYYY para anual

  @Column({ type: 'date' })
  period_start: Date;

  @Column({ type: 'date' })
  period_end: Date;

  @Column({
    type: 'varchar',
    length: 20,
    default: AccountingPeriodStatus.OPEN,
  })
  status: AccountingPeriodStatus;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closed_by_profile: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  closed_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  closing_entry_id: string | null; // ID del asiento de cierre generado

  @Column({ type: 'text', nullable: true })
  closing_note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
