import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Store } from './store.entity';

/**
 * Entity para registrar eventos de seguridad
 * Implementa auditoría según OWASP best practices
 */
@Entity('security_audit_log')
export class SecurityAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  @Index()
  event_type: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  store_id: string | null;

  @ManyToOne(() => Store, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'inet', nullable: true })
  @Index()
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'text', nullable: true })
  request_path: string | null;

  @Column({ type: 'text', nullable: true })
  request_method: string | null;

  @Column({ type: 'text' })
  @Index()
  status: 'success' | 'failure' | 'blocked';

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  @Index()
  created_at: Date;
}
