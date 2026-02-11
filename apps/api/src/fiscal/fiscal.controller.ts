import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FiscalSequenceService } from './fiscal-sequence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('fiscal')
@UseGuards(JwtAuthGuard)
export class FiscalController {
  constructor(private readonly fiscalService: FiscalSequenceService) {}

  private resolveStoreId(storeIdFromRequest: string | undefined, req: any): string {
    const storeId = storeIdFromRequest || req?.user?.store_id;
    if (!storeId) {
      throw new BadRequestException('store_id es requerido');
    }
    return storeId;
  }

  @Post('reserve-range')
  async reserveRange(
    @Body()
    body: {
      store_id?: string;
      series_id: string;
      device_id: string;
      quantity?: number;
    },
    @Req() req: any,
  ) {
    const storeId = this.resolveStoreId(body.store_id, req);
    const range = await this.fiscalService.reserveRange(
      storeId,
      body.series_id,
      body.device_id,
      body.quantity,
    );

    return {
      id: range.id,
      store_id: range.store_id,
      series_id: range.series_id,
      device_id: range.device_id,
      range_start: range.range_start,
      range_end: range.range_end,
      used_up_to: range.used_up_to,
      status: range.status,
      granted_at: range.granted_at,
      expires_at: range.expires_at,
    };
  }

  @Get('active-range')
  async getActiveRange(
    @Query('store_id') storeId: string | undefined,
    @Query('series_id') seriesId: string,
    @Query('device_id') deviceId: string,
    @Req() req: any,
  ) {
    const resolvedStoreId = this.resolveStoreId(storeId, req);
    const range = await this.fiscalService.getActiveRange(
      resolvedStoreId,
      seriesId,
      deviceId,
    );

    if (!range) {
      return { has_range: false };
    }

    return {
      has_range: true,
      id: range.id,
      store_id: range.store_id,
      series_id: range.series_id,
      device_id: range.device_id,
      range_start: range.range_start,
      range_end: range.range_end,
      used_up_to: range.used_up_to,
      remaining: range.range_end - range.used_up_to,
      status: range.status,
      granted_at: range.granted_at,
      expires_at: range.expires_at,
    };
  }

  @Get('device-ranges')
  async getDeviceRanges(
    @Query('store_id') storeId: string | undefined,
    @Query('series_id') seriesId: string,
    @Query('device_id') deviceId: string,
    @Req() req: any,
  ) {
    const resolvedStoreId = this.resolveStoreId(storeId, req);
    const ranges = await this.fiscalService.getRangesForDevice(
      resolvedStoreId,
      seriesId,
      deviceId,
    );

    return { ranges };
  }
}
