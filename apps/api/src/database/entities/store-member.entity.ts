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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  profile: Profile;
}
