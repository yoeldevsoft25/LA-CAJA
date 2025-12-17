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

@Entity('fiscal_configs')
@Index(['store_id'], { unique: true })
export class FiscalConfig {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  tax_id: string;

  @Column({ type: 'varchar', length: 200 })
  business_name: string;

  @Column({ type: 'text' })
  business_address: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  business_phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  business_email: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 16.0 })
  default_tax_rate: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fiscal_authorization_number: string | null;

  @Column({ type: 'date', nullable: true })
  fiscal_authorization_date: Date | null;

  @Column({ type: 'date', nullable: true })
  fiscal_authorization_expiry: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fiscal_control_system: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
