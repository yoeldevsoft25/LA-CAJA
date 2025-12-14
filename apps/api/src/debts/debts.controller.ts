import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { DebtsService } from './debts.service';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DebtStatus } from '../database/entities/debt.entity';

@Controller('debts')
@UseGuards(JwtAuthGuard)
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Post('from-sale/:saleId')
  @HttpCode(HttpStatus.CREATED)
  async createFromSale(
    @Param('saleId') saleId: string,
    @Body('customer_id') customerId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.debtsService.createDebtFromSale(storeId, saleId, customerId);
  }

  @Post(':id/payments')
  @HttpCode(HttpStatus.CREATED)
  async addPayment(
    @Param('id') debtId: string,
    @Body() dto: CreateDebtPaymentDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    
    // Validar que debtId no sea null o undefined
    if (!debtId || debtId.trim() === '') {
      throw new BadRequestException('El ID de la deuda es requerido');
    }
    
    // Log para debugging
    console.log('AddPayment - debtId:', debtId, 'storeId:', storeId, 'dto:', JSON.stringify(dto));
    return this.debtsService.addPayment(storeId, debtId, dto);
  }

  @Get('customer/:customerId')
  async getDebtsByCustomer(
    @Param('customerId') customerId: string,
    @Query('include_paid') includePaid: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.debtsService.getDebtsByCustomer(
      storeId,
      customerId,
      includePaid === 'true',
    );
  }

  @Get('customer/:customerId/summary')
  async getDebtSummary(
    @Param('customerId') customerId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.debtsService.getDebtSummary(storeId, customerId);
  }

  @Get()
  async findAll(@Query('status') status: string, @Request() req: any) {
    const storeId = req.user.store_id;
    const debtStatus = status ? (status as DebtStatus) : undefined;
    return this.debtsService.findAll(storeId, debtStatus);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.debtsService.findOne(storeId, id);
  }
}

