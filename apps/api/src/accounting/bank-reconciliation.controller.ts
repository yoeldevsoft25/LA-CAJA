import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { BankReconciliationService } from './bank-reconciliation.service';
import { BankStatement, BankTransaction } from '../database/entities/index';

@Controller('accounting/bank-reconciliation')
export class BankReconciliationController {
    constructor(private readonly service: BankReconciliationService) { }

    @Post('statements')
    async createStatement(@Body() data: Partial<BankStatement>) {
        return this.service.createStatement(data);
    }

    @Get('statements')
    async listStatements(@Query('store_id') storeId: string) {
        return this.service.listStatements(storeId);
    }

    @Get('statements/:id')
    async getStatement(@Param('id', ParseUUIDPipe) id: string) {
        return this.service.getStatement(id);
    }

    @Post('statements/:id/transactions')
    async addTransactions(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { transactions: Partial<BankTransaction>[] }
    ) {
        return this.service.addTransactions(id, body.transactions);
    }

    @Post('statements/:id/auto-match')
    async autoMatch(@Param('id', ParseUUIDPipe) id: string) {
        return this.service.autoMatch(id);
    }
}
