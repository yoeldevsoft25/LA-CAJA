import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BankStatement } from './bank-statement.entity';
import { JournalEntry } from './journal-entry.entity';

@Entity('bank_transactions')
export class BankTransaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    bank_statement_id: string;

    @ManyToOne(() => BankStatement, statement => statement.lines, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'bank_statement_id' })
    statement: BankStatement;

    @Column('date')
    transaction_date: Date;

    @Column('text')
    description: string;

    @Column({ nullable: true })
    reference_number: string;

    @Column('decimal', { precision: 20, scale: 2 })
    amount: number;

    @Column({ type: 'enum', enum: ['debit', 'credit'] })
    type: 'debit' | 'credit';

    @Column('decimal', { precision: 20, scale: 2, nullable: true })
    balance_after: number;

    @Column({ default: false })
    is_reconciled: boolean;

    @Column('uuid', { nullable: true })
    matched_entry_id: string;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'matched_entry_id' })
    matched_entry: JournalEntry;

    @Column('text', { nullable: true })
    reconciliation_notes: string;

    @Column('jsonb', { nullable: true })
    metadata: Record<string, any>;
}
