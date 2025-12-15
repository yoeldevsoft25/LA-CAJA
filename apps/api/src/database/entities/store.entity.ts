import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('stores')
export class Store {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'text', default: 'active' })
  license_status: string;

  @Column({ type: 'timestamptz', nullable: true })
  license_expires_at: Date | null;

  @Column({ type: 'integer', default: 3 })
  license_grace_days: number;

  @Column({ type: 'text', nullable: true })
  license_plan: string | null;

  @Column({ type: 'text', nullable: true })
  license_notes: string | null;
}
