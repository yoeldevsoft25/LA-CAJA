import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCustomerDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.customersService.create(storeId, dto);
  }

  @Get()
  async findAll(@Query('search') search: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.customersService.findAll(storeId, search);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.customersService.findOne(storeId, id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.customersService.update(storeId, id, dto);
  }

  /**
   * Get customer's purchase history including summary and recent sales
   */
  @Get(':id/purchase-history')
  async getPurchaseHistory(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const limitNum = parseInt(limit, 10) || 10;
    return this.customersService.getPurchaseHistory(storeId, id, limitNum);
  }

  /**
   * Check if customer has available credit for a FIAO purchase
   */
  @Get(':id/credit-check')
  async checkCredit(
    @Param('id') id: string,
    @Query('amount') amount: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const amountUsd = parseFloat(amount) || 0;
    return this.customersService.checkCreditAvailable(storeId, id, amountUsd);
  }
}
