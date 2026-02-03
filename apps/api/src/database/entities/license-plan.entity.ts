import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('license_plans')
export class SubscriptionPlan {
  @PrimaryColumn('text')
  code: string; // 'FREEMIUM', 'EMPRENDEDOR', 'BASICO', 'EMPRESARIAL'

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  price_monthly: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  price_yearly: number;

  @Column('text', { default: 'USD' })
  currency: string;

  // Features enabled for this plan (e.g., ['fiscal', 'accounting', 'multi-store'])
  @Column('jsonb', { default: [] })
  features: string[];

  // Limits for this plan (e.g., { users: 1, products: 100 })
  @Column('jsonb', { default: {} })
  limits: Record<string, number>;

  @Column('boolean', { default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
