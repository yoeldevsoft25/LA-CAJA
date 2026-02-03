import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Store } from './store.entity';
import { Table } from './table.entity';
import { Customer } from './customer.entity';

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'seated'
  | 'cancelled'
  | 'completed';

/**
 * Entidad para reservas de mesas
 */
@Entity('reservations')
@Index(['store_id'])
@Index(['table_id'])
@Index(['reservation_date', 'reservation_time'])
@Index(['status'])
export class Reservation {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Table, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'table_id' })
  table: Table | null;

  @Column({ type: 'uuid', nullable: true })
  table_id: string | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  customer_name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  customer_phone: string | null;

  @Column({ type: 'date' })
  reservation_date: Date;

  @Column({ type: 'time' })
  reservation_time: string;

  @Column({ type: 'int' })
  party_size: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ReservationStatus;

  @Column({ type: 'text', nullable: true })
  special_requests: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;
}
