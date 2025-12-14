import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Request, Query, BadRequestException } from '@nestjs/common';
import { SyncService } from './sync.service';
import { PushSyncDto, PushSyncResponseDto } from './dto/push-sync.dto';
import { SyncStatusDto } from './dto/sync-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @HttpCode(HttpStatus.OK)
  async push(@Body() dto: PushSyncDto, @Request() req: any): Promise<PushSyncResponseDto> {
    // Validar que el store_id del request coincida con el del token
    const storeId = req.user.store_id;
    if (dto.store_id !== storeId) {
      throw new BadRequestException('store_id no autorizado');
    }
    return this.syncService.push(dto);
  }

  @Get('status')
  async getSyncStatus(
    @Query('device_id') deviceId: string,
    @Request() req: any,
  ): Promise<SyncStatusDto> {
    const storeId = req.user.store_id;
    if (!deviceId) {
      throw new BadRequestException('device_id es requerido');
    }
    return this.syncService.getSyncStatus(storeId, deviceId);
  }

  @Get('last-seq')
  async getLastProcessedSeq(
    @Query('device_id') deviceId: string,
    @Request() req: any,
  ): Promise<{ last_seq: number }> {
    const storeId = req.user.store_id;
    if (!deviceId) {
      throw new BadRequestException('device_id es requerido');
    }
    const lastSeq = await this.syncService.getLastProcessedSeq(storeId, deviceId);
    return { last_seq: lastSeq };
  }
}


