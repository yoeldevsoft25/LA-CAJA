import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Store } from './store.entity';
import { Profile } from './profile.entity';
import { LicensePaymentDocument } from './license-payment-document.entity';
import { LicensePaymentVerification } from './license-payment-verification.entity';

export enum LicensePaymentStatus {
  PENDING = 'pending',
  VERIFYING = 'verifying',
  VERIFIED = 'verified',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum LicensePaymentMethod {
  PAGO_MOVIL = 'pago_movil',
  TRANSFERENCIA = 'transferencia',
  ZELLE = 'zelle',
  EFECTIVO = 'efectivo',
  OTHER = 'other',
}

export enum LicensePlan {
  FREEMIUM = 'freemium',
  BASICO = 'basico',
  PROFESIONAL = 'profesional',
  EMPRESARIAL = 'empresarial',
}

export enum BillingPeriod {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Entity('license_payments')
@Index(['store_id'])
@Index(['status'])
@Index(['payment_reference'])
@Index(['created_at'])
@Index(['expires_at'])
export class LicensePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  // Información del plan
  @Column({ type: 'varchar', length: 50 })
  plan: LicensePlan;

  @Column({ type: 'varchar', length: 20 })
  billing_period: BillingPeriod;

  // Montos
  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  amount_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  exchange_rate: number | null;

  // Información del pago
  @Column({ type: 'varchar', length: 50 })
  payment_method: LicensePaymentMethod;

  @Column({ type: 'varchar', length: 100 })
  payment_reference: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  bank_code: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_number: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  account_number: string | null;

  // Estado
  @Column({
    type: 'varchar',
    length: 20,
    default: LicensePaymentStatus.PENDING,
  })
  status: LicensePaymentStatus;

  // Verificación
  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  verified_by: string | null;

  @Column({ type: 'boolean', default: false })
  auto_verified: boolean;

  @Column({ type: 'integer', default: 0 })
  verification_attempts: number;

  // Aprobación
  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approved_by: string | null;

  // Rechazo
  @Column({ type: 'timestamptz', nullable: true })
  rejected_at: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rejected_by: string | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  // Notas
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Fechas
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  // Relaciones
  @OneToMany(() => LicensePaymentDocument, (document) => document.payment, {
    cascade: true,
  })
  documents: LicensePaymentDocument[];

  @OneToMany(
    () => LicensePaymentVerification,
    (verification) => verification.payment,
    { cascade: true },
  )
  verifications: LicensePaymentVerification[];
}
