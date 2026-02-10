import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull } from 'typeorm';
import { BankStatement } from '../database/entities/bank-statement.entity';
import { BankTransaction } from '../database/entities/bank-transaction.entity';
import { JournalEntry } from '../database/entities/journal-entry.entity';

@Injectable()
export class BankReconciliationService {
    private readonly logger = new Logger(BankReconciliationService.name);

    constructor(
        @InjectRepository(BankStatement)
        private readonly statementRepository: Repository<BankStatement>,
        @InjectRepository(BankTransaction)
        private readonly transactionRepository: Repository<BankTransaction>,
        @InjectRepository(JournalEntry)
        private readonly journalEntryRepository: Repository<JournalEntry>,
    ) { }

    async createStatement(data: Partial<BankStatement>): Promise<BankStatement> {
        const statement = this.statementRepository.create(data);
        return this.statementRepository.save(statement);
    }

    async getStatement(id: string): Promise<BankStatement> {
        const statement = await this.statementRepository.findOne({
            where: { id },
            relations: ['lines', 'lines.matched_entry'],
            order: {
                lines: {
                    transaction_date: 'ASC',
                },
            },
        });

        if (!statement) {
            throw new NotFoundException(`Bank statement with ID ${id} not found`);
        }

        return statement;
    }

    async listStatements(storeId: string): Promise<BankStatement[]> {
        return this.statementRepository.find({
            where: { store_id: storeId },
            order: {
                period_start: 'DESC',
            },
        });
    }

    async addTransactions(
        statementId: string,
        transactions: Partial<BankTransaction>[],
    ): Promise<BankTransaction[]> {
        const statement = await this.getStatement(statementId);

        const entities = transactions.map(t =>
            this.transactionRepository.create({
                ...t,
                bank_statement_id: statement.id,
                is_reconciled: false,
            })
        );

        const saved = await this.transactionRepository.save(entities);

        // Update totals
        const allLines = await this.transactionRepository.find({ where: { bank_statement_id: statementId } });
        statement.total_credits = allLines
            .filter(l => l.type === 'credit')
            .reduce((sum, l) => sum + Number(l.amount), 0);
        statement.total_debits = allLines
            .filter(l => l.type === 'debit')
            .reduce((sum, l) => sum + Number(l.amount), 0);

        await this.statementRepository.save(statement);

        return saved;
    }

    async autoMatch(statementId: string): Promise<{ matched: number }> {
        const statement = await this.getStatement(statementId);
        const transactions = statement.lines.filter(t => !t.is_reconciled);

        if (transactions.length === 0) return { matched: 0 };

        // Get date range with buffer
        const startDate = new Date(statement.period_start);
        startDate.setDate(startDate.getDate() - 5);
        const endDate = new Date(statement.period_end);
        endDate.setDate(endDate.getDate() + 5);

        // Fetch candidate entries
        // We look for JournalEntries that match amount and approximate date
        const entries = await this.journalEntryRepository.find({
            where: {
                store_id: statement.store_id,
                entry_date: Between(startDate, endDate),
                // Optimize: match by amount is hard in SQL for large sets without index, but okay for store scope
            },
            relations: ['lines'],
        });

        let matchedCount = 0;

        for (const tx of transactions) {
            // Find candidate
            const candidate = entries.find(e => {
                // Amount match
                const amountBS = Number(e.total_debit_bs); // Simplifying assumption: check total of entry or specific line?
                // Bank transaction amount is usually a single movement. 
                // Journal Entry might have multiple lines. 
                // We should compare against the entry totals or specific cash account lines?
                // For simplicity v1: compare against entry totals

                let entryAmount = 0;
                if (statement.currency === 'BS') {
                    entryAmount = Number(e.total_debit_bs) || Number(e.total_credit_bs);
                } else {
                    entryAmount = Number(e.total_debit_usd) || Number(e.total_credit_usd);
                }

                const amountMatch = Math.abs(entryAmount - Number(tx.amount)) < 0.01;

                // Date match (simplify to same day or close)
                const dateDiff = Math.abs(new Date(e.entry_date).getTime() - new Date(tx.transaction_date).getTime());
                const daysDiff = dateDiff / (1000 * 3600 * 24);
                const dateMatch = daysDiff <= 3; // +/- 3 days

                return amountMatch && dateMatch;
            });

            if (candidate) {
                tx.matched_entry = candidate;
                tx.matched_entry_id = candidate.id;
                tx.is_reconciled = true;
                tx.reconciliation_notes = 'Auto-matched by amount and date';
                await this.transactionRepository.save(tx);
                matchedCount++;

                // Remove from candidates to avoid double matching
                const index = entries.indexOf(candidate);
                entries.splice(index, 1);
            }
        }

        if (matchedCount > 0) {
            const remaining = await this.transactionRepository.count({ where: { bank_statement_id: statementId, is_reconciled: false } });
            if (remaining === 0) {
                statement.status = 'reconciled';
                await this.statementRepository.save(statement);
            }
        }

        return { matched: matchedCount };
    }
}
