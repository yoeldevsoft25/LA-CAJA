import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('stores')
export class Store {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

