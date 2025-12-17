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

export type ExchangeRateSource = 'api' | 'manual';

@Entity('exchange_rates')
@Index(['store_id'])
@Index(['store_id', 'is_active', 'effective_from', 'effective_until'], {
  where: 'is_active = true',
})
@Index(['store_id', 'effective_from'], { where: 'is_active = true' })
export class ExchangeRate {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  rate: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'manual',
  })
  source: ExchangeRateSource;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  effective_from: Date;

  @Column({ type: 'timestamptz', nullable: true })
  effective_until: Date | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

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
}
