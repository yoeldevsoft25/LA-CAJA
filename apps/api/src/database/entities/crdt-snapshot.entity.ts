import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('crdt_snapshots')
@Index(['store_id', 'entity', 'entity_id'], { unique: true })
export class CrdtSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column()
  entity: string; // e.g., 'product', 'inventory', 'cash'

  @Column()
  entity_id: string;

  @Column()
  version: number;

  @Column()
  hash: string; // Hash del estado para verificación de integridad

  @Column('jsonb')
  state: any; // El estado serializado del CRDT

  @Column('jsonb')
  vector_clock: Record<string, number>;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_event_at: Date;

  @Column({ default: 0 })
  event_count: number; // Número de eventos absorbidos en este snapshot
}
