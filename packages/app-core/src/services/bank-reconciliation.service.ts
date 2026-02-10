import { api } from '../runtime/api';
import { BankStatement, BankTransaction } from '../types/accounting.types';

export const bankReconciliationService = {
    async createStatement(data: Partial<BankStatement>): Promise<BankStatement> {
        const response = await api.post<BankStatement>('/accounting/bank-reconciliation/statements', data);
        return response.data;
    },

    async listStatements(storeId: string): Promise<BankStatement[]> {
        const response = await api.get<BankStatement[]>('/accounting/bank-reconciliation/statements', { params: { store_id: storeId } });
        return response.data;
    },

    async getStatement(id: string): Promise<BankStatement> {
        const response = await api.get<BankStatement>(`/accounting/bank-reconciliation/statements/${id}`);
        return response.data;
    },

    async addTransactions(statementId: string, transactions: Partial<BankTransaction>[]): Promise<BankTransaction[]> {
        const response = await api.post<BankTransaction[]>(`/accounting/bank-reconciliation/statements/${statementId}/transactions`, { transactions });
        return response.data;
    },

    async autoMatch(statementId: string): Promise<{ matched: number }> {
        const response = await api.post<{ matched: number }>(`/accounting/bank-reconciliation/statements/${statementId}/auto-match`);
        return response.data;
    },
};
