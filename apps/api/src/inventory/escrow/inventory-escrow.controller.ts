import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InventoryEscrowService } from './inventory-escrow.service';
import { GrantStockQuotaDto } from './dto/grant-stock-quota.dto';
import { TransferStockQuotaDto } from './dto/transfer-stock-quota.dto';
import { BatchGrantStockQuotaDto } from './dto/batch-grant-stock-quota.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('inventory/escrow')
@UseGuards(JwtAuthGuard)
export class InventoryEscrowController {
  constructor(private readonly escrowService: InventoryEscrowService) { }

  async grantQuota(@Body() dto: GrantStockQuotaDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    return this.escrowService.grantQuota(storeId, userId, dto);
  }

  @Post('batch-grant')
  async batchGrantQuota(@Body() dto: BatchGrantStockQuotaDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    return this.escrowService.batchGrantQuota(storeId, userId, dto);
  }

  @Post('transfer')
  async transferQuota(@Body() dto: TransferStockQuotaDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    return this.escrowService.transferQuota(storeId, userId, dto);
  }

  @Get('status/:store_id')
  async getStatus(@Param('store_id') storeId: string) {
    // TODO: Validate user belongs to storeId
    return this.escrowService.getStatus(storeId);
  }
}
