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
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { ShipTransferDto } from './dto/ship-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  async create(@Body() dto: CreateTransferDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.transfersService.create(storeId, dto, userId);
  }

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('warehouse_id') warehouseId?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    return this.transfersService.findAll(storeId, status as any, warehouseId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.transfersService.findOne(storeId, id);
  }

  @Put(':id/ship')
  async ship(
    @Param('id') id: string,
    @Body() dto: ShipTransferDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.transfersService.ship(storeId, id, dto, userId);
  }

  @Put(':id/receive')
  async receive(
    @Param('id') id: string,
    @Body() dto: ReceiveTransferDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.transfersService.receive(storeId, id, dto, userId);
  }

  @Put(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.transfersService.cancel(storeId, id, userId);
  }
}
