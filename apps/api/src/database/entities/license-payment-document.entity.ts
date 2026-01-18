import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { LicensePayment } from './license-payment.entity';
import { Profile } from './profile.entity';

export enum DocumentFileType {
  IMAGE = 'image',
  PDF = 'pdf',
  OTHER = 'other',
}

@Entity('license_payment_documents')
export class LicensePaymentDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LicensePayment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: LicensePayment;

  @Column('uuid')
  payment_id: string;

  // Información del archivo
  @Column({ type: 'varchar', length: 255 })
  file_name: string;

  @Column({ type: 'text' })
  file_path: string;

  @Column({ type: 'varchar', length: 20 })
  file_type: DocumentFileType;

  @Column({ type: 'bigint' })
  file_size: number;

  // Metadatos
  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  uploaded_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
