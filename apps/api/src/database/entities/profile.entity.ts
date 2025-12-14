import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  full_name: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

