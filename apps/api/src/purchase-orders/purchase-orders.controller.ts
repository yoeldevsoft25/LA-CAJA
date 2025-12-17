import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  async create(@Body() dto: CreatePurchaseOrderDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.purchaseOrdersService.create(storeId, dto, userId);
  }

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('supplier_id') supplierId?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    return this.purchaseOrdersService.findAll(
      storeId,
      status as any,
      supplierId,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.purchaseOrdersService.findOne(storeId, id);
  }

  @Put(':id/send')
  async send(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.purchaseOrdersService.send(storeId, id);
  }

  @Put(':id/confirm')
  async confirm(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.purchaseOrdersService.confirm(storeId, id);
  }

  @Put(':id/receive')
  async receive(
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.purchaseOrdersService.receive(storeId, id, dto, userId);
  }

  @Put(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.purchaseOrdersService.cancel(storeId, id);
  }
}
