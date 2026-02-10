import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { BankTransaction } from './bank-transaction.entity';

@Entity('bank_statements')
export class BankStatement {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    store_id: string;

    @Column()
    bank_name: string;

    @Column()
    account_number: string;

    @Column('date')
    period_start: Date;

    @Column('date')
    period_end: Date;

    @Column({ type: 'enum', enum: ['BS', 'USD'] })
    currency: 'BS' | 'USD';

    @Column('decimal', { precision: 20, scale: 2, default: 0 })
    total_debits: number;

    @Column('decimal', { precision: 20, scale: 2, default: 0 })
    total_credits: number;

    @Column('decimal', { precision: 20, scale: 2, default: 0 })
    starting_balance: number;

    @Column('decimal', { precision: 20, scale: 2, default: 0 })
    ending_balance: number;

    @Column({ type: 'enum', enum: ['draft', 'pending', 'reconciled'], default: 'draft' })
    status: 'draft' | 'pending' | 'reconciled';

    @Column({ nullable: true })
    filename: string;

    @Column({ nullable: true })
    created_by: string;

    @OneToMany(() => BankTransaction, transaction => transaction.statement, { cascade: true })
    lines: BankTransaction[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
