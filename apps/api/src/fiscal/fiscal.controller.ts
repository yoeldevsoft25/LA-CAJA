import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { FiscalSequenceService } from './fiscal-sequence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('fiscal')
@UseGuards(JwtAuthGuard)
export class FiscalController {
  constructor(private readonly fiscalService: FiscalSequenceService) {}

  @Post('reserve-range')
  async reserveRange(
    @Body()
    body: {
      store_id: string;
      series_id: string;
      device_id: string;
      quantity?: number;
    },
  ) {
    const range = await this.fiscalService.reserveRange(
      body.store_id,
      body.series_id,
      body.device_id,
      body.quantity,
    );

    return {
      device_id: range.device_id,
      range_start: range.range_start,
      range_end: range.range_end,
      expires_at: range.expires_at,
    };
  }

  @Get('active-range')
  async getActiveRange(
    @Query('store_id') storeId: string,
    @Query('series_id') seriesId: string,
    @Query('device_id') deviceId: string,
  ) {
    const range = await this.fiscalService.getActiveRange(
      storeId,
      seriesId,
      deviceId,
    );

    if (!range) {
      return { has_range: false };
    }

    return {
      has_range: true,
      device_id: range.device_id,
      range_start: range.range_start,
      range_end: range.range_end,
      used_up_to: range.used_up_to,
      remaining: range.range_end - range.used_up_to,
      expires_at: range.expires_at,
    };
  }

  @Get('device-ranges')
  async getDeviceRanges(
    @Query('store_id') storeId: string,
    @Query('series_id') seriesId: string,
    @Query('device_id') deviceId: string,
  ) {
    const ranges = await this.fiscalService.getRangesForDevice(
      storeId,
      seriesId,
      deviceId,
    );

    return { ranges };
  }
}
