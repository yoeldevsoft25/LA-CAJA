import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { PushSyncDto, PushSyncResponseDto } from './dto/push-sync.dto';
import { SyncStatusDto } from './dto/sync-status.dto';
import { ResolveConflictDto } from './dto/resolve-conflict.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FederationAuthGuard } from './guards/federation-auth.guard';

@Controller('sync')
@UseGuards(FederationAuthGuard, JwtAuthGuard)
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly conflictResolutionService: ConflictResolutionService,
  ) { }

  @Post('push')
  @HttpCode(HttpStatus.OK)
  async push(
    @Body() dto: PushSyncDto,
    @Request() req: any,
  ): Promise<PushSyncResponseDto> {
    // Validar que el store_id del request coincida con el del token
    const storeId = req.user.store_id;
    if (req.user.sub !== 'system-federation' && dto.store_id !== storeId) {
      throw new BadRequestException('store_id no autorizado');
    }
    return this.syncService.push(dto, req.user.sub);
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
    const lastSeq = await this.syncService.getLastProcessedSeq(
      storeId,
      deviceId,
    );
    return { last_seq: lastSeq };
  }

  @Get('pull')
  async pull(
    @Query('last_checkpoint') lastCheckpoint: string,
    @Query('device_id') deviceId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const since = new Date(Number(lastCheckpoint) || 0);

    // Si no envía device_id, no excluimos nada (sería raro pero válido)
    return this.syncService.pullEvents(storeId, since, deviceId);
  }

  @Post('resolve-conflict')
  @HttpCode(HttpStatus.OK)
  async resolveConflict(
    @Body() dto: ResolveConflictDto,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;

    try {
      await this.conflictResolutionService.resolveManualConflict(
        dto.conflict_id,
        storeId,
        dto.resolution,
        userId,
      );

      return {
        success: true,
        message: 'Conflicto resuelto correctamente',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Error resolviendo conflicto',
      );
    }
  }
}
