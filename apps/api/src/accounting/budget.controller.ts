import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { BudgetService } from './budget.service';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // Assuming Auth Guard exists, check imports

@Controller('accounting/budgets')
// @UseGuards(JwtAuthGuard) // Re-enable when auth is confirmed
export class BudgetController {
    constructor(private readonly budgetService: BudgetService) { }

    @Post()
    async createBudget(
        @Body()
        body: {
            store_id: string;
            name: string;
            description?: string;
            period_start: string;
            period_end: string;
            created_by?: string;
        },
    ) {
        return this.budgetService.createBudget(body.store_id, body);
    }

    @Get()
    async listBudgets(@Query('store_id') storeId: string) {
        return this.budgetService.listBudgets(storeId);
    }

    @Get(':id')
    async getBudget(
        @Query('store_id') storeId: string,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.budgetService.getBudget(storeId, id);
    }

    @Put(':id')
    async updateBudgetLines(
        @Query('store_id') storeId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body()
        body: {
            lines: Array<{
                account_id: string;
                amount_bs: number;
                amount_usd: number;
                notes?: string;
            }>;
        },
    ) {
        return this.budgetService.updateBudgetLines(storeId, id, body.lines);
    }

    @Delete(':id')
    async deleteBudget(
        @Query('store_id') storeId: string,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.budgetService.deleteBudget(storeId, id);
    }

    @Get(':id/comparison')
    async getBudgetVsActuals(
        @Query('store_id') storeId: string,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.budgetService.getBudgetVsActuals(storeId, id);
    }
}
