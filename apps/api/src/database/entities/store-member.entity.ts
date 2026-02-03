import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { Profile } from './profile.entity';

export type StoreRole = 'owner' | 'cashier';

@Entity('store_members')
export class StoreMember {
  @PrimaryColumn('uuid')
  store_id: string;

  @PrimaryColumn('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 20 })
  role: StoreRole;

  @Column({ type: 'text', nullable: true })
  pin_hash: string | null;

  @Column({ type: 'integer', default: 0 })
  failed_login_attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  locked_until: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /**
   * Verifica si la cuenta está bloqueada
   */
  isLocked(): boolean {
    if (!this.locked_until) {
      return false;
    }
    return new Date() < this.locked_until;
  }

  /**
   * Resetea los intentos fallidos (después de login exitoso)
   */
  resetFailedAttempts(): void {
    this.failed_login_attempts = 0;
    this.locked_until = null;
  }

  /**
   * Incrementa los intentos fallidos y bloquea si es necesario
   */
  incrementFailedAttempts(
    maxAttempts: number = 5,
    lockDurationMinutes: number = 15,
  ): void {
    this.failed_login_attempts += 1;
    if (this.failed_login_attempts >= maxAttempts) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + lockDurationMinutes);
      this.locked_until = lockUntil;
    }
  }

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  profile: Profile;
}
