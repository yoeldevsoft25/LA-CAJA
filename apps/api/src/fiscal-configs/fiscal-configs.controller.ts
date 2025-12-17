import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FiscalConfigsService } from './fiscal-configs.service';
import { CreateFiscalConfigDto } from './dto/create-fiscal-config.dto';
import { UpdateFiscalConfigDto } from './dto/update-fiscal-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('fiscal-configs')
@UseGuards(JwtAuthGuard)
export class FiscalConfigsController {
  constructor(private readonly fiscalConfigsService: FiscalConfigsService) {}

  @Post()
  async create(@Body() dto: CreateFiscalConfigDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.fiscalConfigsService.upsert(storeId, dto);
  }

  @Get()
  async findOne(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.fiscalConfigsService.findOne(storeId);
  }

  @Put()
  async update(@Body() dto: UpdateFiscalConfigDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.fiscalConfigsService.update(storeId, dto);
  }
}
