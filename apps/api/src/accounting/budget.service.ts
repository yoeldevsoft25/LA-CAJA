import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { AccountingBudget } from '../database/entities/accounting-budget.entity';
import { AccountingBudgetLine } from '../database/entities/accounting-budget-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class BudgetService {
    constructor(
        @InjectRepository(AccountingBudget)
        private budgetRepository: Repository<AccountingBudget>,
        @InjectRepository(AccountingBudgetLine)
        private budgetLineRepository: Repository<AccountingBudgetLine>,
        @InjectRepository(ChartOfAccount)
        private accountRepository: Repository<ChartOfAccount>,
        @InjectRepository(JournalEntryLine)
        private journalEntryLineRepository: Repository<JournalEntryLine>,
    ) { }

    /**
     * Crear presupuesto
     */
    async createBudget(
        storeId: string,
        data: {
            name: string;
            description?: string;
            period_start: string;
            period_end: string;
            created_by?: string;
        },
    ): Promise<AccountingBudget> {
        const budget = this.budgetRepository.create({
            id: randomUUID(),
            store_id: storeId,
            name: data.name,
            description: data.description,
            period_start: new Date(data.period_start),
            period_end: new Date(data.period_end),
            status: 'draft',
            created_by: data.created_by,
            total_amount_bs: 0,
            total_amount_usd: 0,
        });

        return this.budgetRepository.save(budget);
    }

    /**
     * Actualizar líneas de presupuesto
     */
    async updateBudgetLines(
        storeId: string,
        budgetId: string,
        lines: Array<{
            account_id: string;
            amount_bs: number;
            amount_usd: number;
            notes?: string;
        }>,
    ): Promise<AccountingBudget> {
        const budget = await this.budgetRepository.findOne({
            where: { id: budgetId, store_id: storeId },
        });

        if (!budget) {
            throw new NotFoundException('Presupuesto no encontrado');
        }

        if (budget.status === 'archived') {
            throw new BadRequestException('No se puede modificar un presupuesto archivado');
        }

        // Calcular totales
        let totalBs = 0;
        let totalUsd = 0;

        // Eliminar líneas anteriores (simple replacement strategy)
        await this.budgetLineRepository.delete({ budget_id: budgetId });

        const newLines = lines.map((line) => {
            totalBs += Number(line.amount_bs || 0);
            totalUsd += Number(line.amount_usd || 0);
            return this.budgetLineRepository.create({
                id: randomUUID(),
                budget_id: budget.id,
                account_id: line.account_id,
                amount_bs: line.amount_bs,
                amount_usd: line.amount_usd,
                notes: line.notes,
            });
        });

        await this.budgetLineRepository.save(newLines);

        // Actualizar totales en header
        budget.total_amount_bs = totalBs;
        budget.total_amount_usd = totalUsd;
        await this.budgetRepository.save(budget);

        return this.getBudget(storeId, budgetId);
    }

    /**
     * Obtener presupuesto con líneas
     */
    async getBudget(storeId: string, budgetId: string): Promise<AccountingBudget> {
        const budget = await this.budgetRepository.findOne({
            where: { id: budgetId, store_id: storeId },
            relations: ['lines', 'lines.account'],
        });

        if (!budget) {
            throw new NotFoundException('Presupuesto no encontrado');
        }

        return budget;
    }

    /**
     * Listar presupuestos
     */
    async listBudgets(storeId: string): Promise<AccountingBudget[]> {
        return this.budgetRepository.find({
            where: { store_id: storeId },
            order: { period_start: 'DESC' },
        });
    }

    /**
     * Eliminar presupuesto
     */
    async deleteBudget(storeId: string, budgetId: string): Promise<void> {
        const budget = await this.budgetRepository.findOne({
            where: { id: budgetId, store_id: storeId },
        });

        if (!budget) {
            throw new NotFoundException('Presupuesto no encontrado');
        }

        await this.budgetRepository.remove(budget);
    }

    /**
     * Obtener Comparativa Presupuesto vs Real
     */
    async getBudgetVsActuals(
        storeId: string,
        budgetId: string,
    ): Promise<{
        budget: AccountingBudget;
        comparison: Array<{
            account_id: string;
            account_code: string;
            account_name: string;
            budget_bs: number;
            actual_bs: number;
            variance_bs: number;
            variance_percent_bs: number;
            budget_usd: number;
            actual_usd: number;
            variance_usd: number;
            variance_percent_usd: number;
        }>;
    }> {
        const budget = await this.getBudget(storeId, budgetId);

        // Obtener Actuals (Movimientos en el rango de fechas)
        // Usamos journal_entry_lines directamente para mayor precisión en rangos arbitrarios
        const actuals = await this.journalEntryLineRepository
            .createQueryBuilder('line')
            .innerJoin('line.entry', 'entry')
            .where('entry.store_id = :storeId', { storeId })
            .andWhere('entry.status = :status', { status: 'posted' })
            .andWhere('entry.entry_date >= :startDate', { startDate: budget.period_start })
            .andWhere('entry.entry_date <= :endDate', { endDate: budget.period_end })
            .select('line.account_id', 'account_id')
            .addSelect('SUM(line.debit_amount_bs)', 'total_debit_bs')
            .addSelect('SUM(line.credit_amount_bs)', 'total_credit_bs')
            .addSelect('SUM(line.debit_amount_usd)', 'total_debit_usd')
            .addSelect('SUM(line.credit_amount_usd)', 'total_credit_usd')
            .groupBy('line.account_id')
            .getRawMany();

        const actualsMap = new Map<string, { bs: number; usd: number }>();

        // Necesitamos saber el tipo de cuenta para calcular el saldo correctamente (Debito vs Credito)
        // Obtenemos los tipos de todas las cuentas involucradas
        const accountIds = [
            ...budget.lines.map(l => l.account_id),
            ...actuals.map(a => a.account_id)
        ];

        const uniqueAccountIds = [...new Set(accountIds)];

        const accounts = await this.accountRepository.find({
            where: { id: In(uniqueAccountIds) },
            select: ['id', 'account_code', 'account_name', 'account_type']
        });

        const accountsMap = new Map(accounts.map(a => [a.id, a]));

        for (const row of actuals) {
            const account = accountsMap.get(row.account_id);
            if (!account) continue;

            const debitBs = Number(row.total_debit_bs || 0);
            const creditBs = Number(row.total_credit_bs || 0);
            const debitUsd = Number(row.total_debit_usd || 0);
            const creditUsd = Number(row.total_credit_usd || 0);

            let netBs = 0;
            let netUsd = 0;

            // Naturaleza de las cuentas
            if (account.account_type === 'asset' || account.account_type === 'expense') {
                netBs = debitBs - creditBs;
                netUsd = debitUsd - creditUsd;
            } else {
                netBs = creditBs - debitBs;
                netUsd = creditUsd - debitUsd;
            }

            actualsMap.set(row.account_id, { bs: netBs, usd: netUsd });
        }

        // Construir comparación
        // Construir comparación
        const comparison: Array<{
            account_id: string;
            account_code: string;
            account_name: string;
            budget_bs: number;
            actual_bs: number;
            variance_bs: number;
            variance_percent_bs: number;
            budget_usd: number;
            actual_usd: number;
            variance_usd: number;
            variance_percent_usd: number;
        }> = [];
        const processedAccounts = new Set<string>();

        // 1. Procesar líneas del presupuesto
        for (const line of budget.lines) {
            const actual = actualsMap.get(line.account_id) || { bs: 0, usd: 0 };
            const account = accountsMap.get(line.account_id);

            if (!account) continue;

            processedAccounts.add(line.account_id);

            const varianceBs = actual.bs - Number(line.amount_bs);
            const varianceUsd = actual.usd - Number(line.amount_usd);

            // Porcentaje: (Actual - Budget) / Budget
            // Evitar división por cero
            const variancePercentBs = Number(line.amount_bs) !== 0
                ? (varianceBs / Number(line.amount_bs)) * 100
                : (actual.bs !== 0 ? 100 : 0);

            const variancePercentUsd = Number(line.amount_usd) !== 0
                ? (varianceUsd / Number(line.amount_usd)) * 100
                : (actual.usd !== 0 ? 100 : 0);

            comparison.push({
                account_id: line.account_id,
                account_code: account.account_code,
                account_name: account.account_name,
                budget_bs: Number(line.amount_bs),
                actual_bs: actual.bs,
                variance_bs: varianceBs,
                variance_percent_bs: variancePercentBs,
                budget_usd: Number(line.amount_usd),
                actual_usd: actual.usd,
                variance_usd: varianceUsd,
                variance_percent_usd: variancePercentUsd,
            });
        }

        // 2. Procesar cuentas con movimiento pero SIN presupuesto (Unbudgeted items)
        for (const [accountId, actual] of actualsMap.entries()) {
            if (!processedAccounts.has(accountId)) {
                const account = accountsMap.get(accountId);
                if (!account) continue;

                // Solo nos interesan cuentas de Ingreso y Gasto típicamente para presupuesto,
                // pero tal vez el usuario presupuestó Capex (Activos). Incluyamos todo si tiene movimiento.

                comparison.push({
                    account_id: accountId,
                    account_code: account.account_code,
                    account_name: account.account_name,
                    budget_bs: 0,
                    actual_bs: actual.bs,
                    variance_bs: actual.bs, // Todo es varianza
                    variance_percent_bs: 100, // 100% sobre presupuesto
                    budget_usd: 0,
                    actual_usd: actual.usd,
                    variance_usd: actual.usd,
                    variance_percent_usd: 100,
                });
            }
        }

        // Ordenar por código de cuenta
        comparison.sort((a, b) => a.account_code.localeCompare(b.account_code));

        return {
            budget,
            comparison
        };
    }
}
