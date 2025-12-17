import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Shift } from './shift.entity';
import { Profile } from './profile.entity';

export enum CutType {
  X = 'X', // Corte intermedio
  Z = 'Z', // Corte final
}

@Entity('shift_cuts')
@Index(['shift_id'])
@Index(['cut_type'])
@Index(['created_at'])
export class ShiftCut {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Shift, (shift) => shift.cuts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;

  @Column('uuid')
  shift_id: string;

  @Column({
    type: 'varchar',
    length: 1,
  })
  cut_type: CutType;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  cut_at: Date;

  @Column({ type: 'jsonb' })
  totals: {
    sales_count: number;
    total_bs: number;
    total_usd: number;
    by_payment_method: Record<string, number>;
    cash_bs: number;
    cash_usd: number;
    pago_movil_bs: number;
    transfer_bs: number;
    other_bs: number;
  };

  @Column({ type: 'int', default: 0 })
  sales_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  printed_at: Date | null;

  @ManyToOne(() => Profile)
  @JoinColumn({ name: 'created_by' })
  creator: Profile;

  @Column('uuid')
  created_by: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;
}
