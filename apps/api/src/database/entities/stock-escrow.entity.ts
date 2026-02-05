import {
    Entity,
    Column,
    PrimaryColumn,
    UpdateDateColumn,
    Index,
    Unique,
} from 'typeorm';

@Entity('stock_escrow')
@Unique(['store_id', 'product_id', 'device_id']) // Ensure one quota per product per device
@Index(['store_id', 'product_id'])
export class StockEscrow {
    @PrimaryColumn('uuid')
    id: string;

    @Column('uuid')
    store_id: string;

    @Column('uuid')
    product_id: string;

    @Column({ type: 'uuid', nullable: true })
    variant_id: string | null;

    @Column('uuid')
    device_id: string;

    @Column({ type: 'numeric', precision: 18, scale: 3, default: 0 })
    qty_granted: number;

    @Column({ type: 'timestamptz', nullable: true })
    expires_at: Date | null;

    @UpdateDateColumn({ type: 'timestamptz' })
    last_updated_at: Date;
}
