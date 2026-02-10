import {
    Entity,
    Column,
    PrimaryColumn,
    ManyToOne,
    JoinColumn,
    Index,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { Store } from './store.entity';
import { Profile } from './profile.entity';
import { AccountingBudgetLine } from './accounting-budget-line.entity';

export type BudgetStatus = 'draft' | 'active' | 'archived';

@Entity('accounting_budgets')
@Index(['store_id'])
@Index(['period_start', 'period_end'])
export class AccountingBudget {
    @PrimaryColumn('uuid')
    id: string;

    @ManyToOne(() => Store, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'store_id' })
    store: Store;

    @Column('uuid')
    store_id: string;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'date' })
    period_start: Date;

    @Column({ type: 'date' })
    period_end: Date;

    @Column({
        type: 'enum',
        enum: ['draft', 'active', 'archived'],
        default: 'draft',
    })
    status: BudgetStatus;

    @Column({ type: 'decimal', precision: 20, scale: 4, default: 0 })
    total_amount_bs: number;

    @Column({ type: 'decimal', precision: 20, scale: 4, default: 0 })
    total_amount_usd: number;

    @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'created_by' })
    creator: Profile;

    @Column({ type: 'uuid', nullable: true })
    created_by: string;

    @OneToMany(() => AccountingBudgetLine, (line) => line.budget)
    lines: AccountingBudgetLine[];

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;
}
