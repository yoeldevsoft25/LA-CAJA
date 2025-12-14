import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('events')
export class Event {
  @PrimaryColumn('uuid')
  event_id: string;

  @Column('uuid')
  store_id: string;

  @Column('uuid')
  device_id: string;

  @Column({ type: 'bigint' })
  seq: number;

  @Column({ type: 'text' })
  type: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'uuid', nullable: true })
  actor_user_id: string | null;

  @Column({ type: 'text', nullable: true })
  actor_role: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  received_at: Date;
}

