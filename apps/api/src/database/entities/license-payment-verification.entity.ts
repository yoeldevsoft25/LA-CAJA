import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { LicensePayment } from './license-payment.entity';

export enum VerificationMethod {
  MERCANTIL_API = 'mercantil_api',
  BANESCO_API = 'banesco_api',
  MANUAL = 'manual',
  OTHER = 'other',
}

export enum VerificationStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  NOT_FOUND = 'not_found',
  ERROR = 'error',
}

@Entity('license_payment_verifications')
@Index(['payment_id'])
@Index(['status'])
@Index(['verification_method'])
@Index(['created_at'])
export class LicensePaymentVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LicensePayment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: LicensePayment;

  @Column('uuid')
  payment_id: string;

  // Método y resultado
  @Column({ type: 'varchar', length: 50 })
  verification_method: VerificationMethod;

  @Column({ type: 'varchar', length: 20 })
  status: VerificationStatus;

  // Datos de respuesta
  @Column({ type: 'jsonb', nullable: true })
  response_data: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  // Timestamps
  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
