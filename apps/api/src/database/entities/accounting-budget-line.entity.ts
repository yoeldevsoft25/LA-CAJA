import {
    Entity,
    Column,
    PrimaryColumn,
    ManyToOne,
    JoinColumn,
    Index,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { AccountingBudget } from './accounting-budget.entity';
import { ChartOfAccount } from './chart-of-accounts.entity';

@Entity('accounting_budget_lines')
@Index(['budget_id'])
@Index(['account_id'])
export class AccountingBudgetLine {
    @PrimaryColumn('uuid')
    id: string;

    @ManyToOne(() => AccountingBudget, (budget) => budget.lines, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'budget_id' })
    budget: AccountingBudget;

    @Column('uuid')
    budget_id: string;

    @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'account_id' })
    account: ChartOfAccount;

    @Column('uuid')
    account_id: string;

    @Column({ type: 'decimal', precision: 20, scale: 4, default: 0 })
    amount_bs: number;

    @Column({ type: 'decimal', precision: 20, scale: 4, default: 0 })
    amount_usd: number;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;
}
