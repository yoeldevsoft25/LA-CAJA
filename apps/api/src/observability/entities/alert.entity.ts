import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export enum AlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  ACKNOWLEDGED = 'acknowledged',
}

@Entity('alerts')
@Index(['status'])
@Index(['service_name'])
@Index(['severity'])
@Index(['created_at'])
@Index(['status', 'created_at'], { where: "status = 'active'" })
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  service_name: string;

  @Column({ type: 'varchar', length: 50 })
  alert_type: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: AlertSeverity,
  })
  severity: AlertSeverity;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: AlertStatus,
    default: AlertStatus.ACTIVE,
  })
  status: AlertStatus;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledged_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  acknowledged_by: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
