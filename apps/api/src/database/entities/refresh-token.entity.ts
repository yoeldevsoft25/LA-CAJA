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
 * Entity para refresh tokens
 * Permite access tokens cortos y refresh tokens largos para mayor seguridad
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  @Index()
  token: string;

  @Column({ type: 'uuid' })
  @Index()
  user_id: string;

  @Column({ type: 'uuid' })
  @Index()
  store_id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ type: 'uuid', nullable: true })
  device_id: string | null;

  @Column({ type: 'text', nullable: true })
  device_info: string | null;

  @Column({ type: 'inet', nullable: true })
  ip_address: string | null;

  @Column({ type: 'timestamptz' })
  @Index()
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @Index()
  revoked_at: Date | null;

  @Column({ type: 'text', nullable: true })
  revoked_reason: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at: Date | null;

  /**
   * Verifica si el token está activo (no expirado ni revocado)
   */
  isActive(): boolean {
    const now = new Date();
    return (
      this.expires_at > now &&
      this.revoked_at === null
    );
  }
}


