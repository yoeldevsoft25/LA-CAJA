import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Store } from './store.entity';
import { SubscriptionPlan } from './license-plan.entity';

export enum LicenseStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due', // Periodo de gracia
  SUSPENDED = 'suspended', // Pago fallido tras gracia
  CANCELLED = 'cancelled', // Cancelado voluntariamente
  TRIAL = 'trial',
}

export enum SubscriptionPeriod {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime',
}

@Entity('store_licenses')
@Index(['store_id', 'status'])
export class StoreLicense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  store_id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('text')
  plan_code: string;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'plan_code' })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: LicenseStatus,
    default: LicenseStatus.ACTIVE,
  })
  status: LicenseStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionPeriod,
    default: SubscriptionPeriod.MONTHLY,
  })
  billing_period: SubscriptionPeriod;

  @Column('timestamptz')
  starts_at: Date;

  @Column('timestamptz')
  expires_at: Date;

  @Column('int', { default: 3 })
  grace_days: number;

  @Column('jsonb', { default: {} })
  custom_limits: Record<string, number>; // Overrides specific to this store

  @Column('jsonb', { default: [] })
  custom_features: string[]; // Overrides specific to this store

  @Column('timestamptz', { nullable: true })
  last_check_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
