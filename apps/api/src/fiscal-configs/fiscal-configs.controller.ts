import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  CheckLicense,
  RequiresFeature,
} from '../licenses/decorators/license.decorator';
import { FiscalConfigsService } from './fiscal-configs.service';
import { CreateFiscalConfigDto } from './dto/create-fiscal-config.dto';
import { UpdateFiscalConfigDto } from './dto/update-fiscal-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('fiscal-configs')
@UseGuards(JwtAuthGuard)
@CheckLicense()
@RequiresFeature('fiscal_printing')
export class FiscalConfigsController {
  constructor(private readonly fiscalConfigsService: FiscalConfigsService) {}

  @Post()
  @Roles('owner')
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
  @Roles('owner')
  async update(@Body() dto: UpdateFiscalConfigDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.fiscalConfigsService.update(storeId, dto);
  }
}
