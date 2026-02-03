import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  full_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  @Index('idx_profiles_email_unique', { where: 'email IS NOT NULL' })
  @Index('idx_profiles_email', { where: 'email IS NOT NULL' })
  email: string | null;

  @Column({ type: 'boolean', default: false })
  email_verified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  email_verified_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
