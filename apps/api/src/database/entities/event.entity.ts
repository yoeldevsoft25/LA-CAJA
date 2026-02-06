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

  // ===== OFFLINE-FIRST WORLD-CLASS FIELDS =====

  @Column({ type: 'jsonb', default: '{}' })
  vector_clock: Record<string, number>;

  @Column({ type: 'text', array: true, default: '{}' })
  causal_dependencies: string[];

  @Column({ type: 'text', default: 'resolved' })
  conflict_status: string;

  @Column({ type: 'jsonb', nullable: true })
  delta_payload: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  full_payload_hash: string | null;

  @Column({ type: 'text', default: 'pending' }) // pending, processed, failed
  projection_status: string;

  @Column({ type: 'text', nullable: true })
  projection_error: string | null;

  @Index('IDX_events_request_id_unique', { unique: true })
  @Column({ type: 'uuid', nullable: true })
  request_id: string | null;
}
