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
import { ProjectionsService } from '../projections/projections.service';
import {
  FederationSyncService,
  FederationStatus,
  FederationReplayResult,
  FederationReplayInventoryResult,
  FederationIdsResult,
  FederationAutoReconcileResult,
  InventoryStockReconcileResult,
} from './federation-sync.service';
import {
  SplitBrainMonitorService,
  FederationHealthReport,
} from './split-brain-monitor.service';
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
    private readonly federationSyncService: FederationSyncService,
    private readonly projectionsService: ProjectionsService,
    private readonly splitBrainMonitorService: SplitBrainMonitorService,
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
    @Query('cursor_event_id') cursorEventId: string,
    @Query('device_id') deviceId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const since = new Date(Number(lastCheckpoint) || 0);

    // Si no envía device_id, no excluimos nada (sería raro pero válido)
    return this.syncService.pullEvents(
      storeId,
      since,
      deviceId,
      100,
      cursorEventId,
    );
  }

  @Get('federation/store-status')
  @UseGuards(FederationAuthGuard)
  async getStoreStatus(
    @Query('store_id') storeId: string,
  ): Promise<{ exists: boolean }> {
    if (!storeId) throw new BadRequestException('store_id is required');
    const knownIds = await this.federationSyncService.getKnownStoreIds(); // Public helper needed? Or access repo via service
    return { exists: knownIds.includes(storeId) };
  }

  @Get('federation/status')
  async getFederationStatus(): Promise<FederationStatus> {
    return this.federationSyncService.getFederationStatus();
  }

  @Get('federation/health')
  @UseGuards(FederationAuthGuard)
  async getFederationHealth(
    @Query('store_id') storeIdQuery: string,
    @Request() req: any,
  ): Promise<FederationHealthReport> {
    const storeId = storeIdQuery || req.user?.store_id;
    if (!storeId) throw new BadRequestException('store_id is required');
    return this.splitBrainMonitorService.getHealthReport(storeId);
  }

  @Get('federation/health/history')
  @UseGuards(FederationAuthGuard)
  async getFederationHealthHistory(
    @Query('store_id') storeIdQuery: string,
    @Query('hours') hoursRaw: string,
    @Request() req: any,
  ): Promise<FederationHealthReport[]> {
    const storeId = storeIdQuery || req.user?.store_id;
    if (!storeId) throw new BadRequestException('store_id is required');
    const hours = hoursRaw ? parseInt(hoursRaw, 10) : 24;
    return this.splitBrainMonitorService.getHealthHistory(storeId, hours);
  }

  @Get('federation/sales-ids')
  async getFederationSalesIds(
    @Query('store_id') storeIdQuery: string,
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('limit') limitRaw: string,
    @Query('offset') offsetRaw: string,
    @Request() req: any,
  ): Promise<FederationIdsResult> {
    const storeId = storeIdQuery || req.user.store_id;
    if (!storeId) {
      throw new BadRequestException('store_id es requerido');
    }
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('date_from y date_to son requeridos');
    }
    const limit = Number(limitRaw || 10000);
    const offset = Number(offsetRaw || 0);
    return this.federationSyncService.getSalesIds(
      storeId,
      dateFrom,
      dateTo,
      limit,
      offset,
    );
  }

  @Get('federation/inventory-movement-ids')
  async getFederationInventoryMovementIds(
    @Query('store_id') storeIdQuery: string,
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('limit') limitRaw: string,
    @Query('offset') offsetRaw: string,
    @Request() req: any,
  ): Promise<FederationIdsResult> {
    const storeId = storeIdQuery || req.user.store_id;
    if (!storeId) {
      throw new BadRequestException('store_id es requerido');
    }
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('date_from y date_to son requeridos');
    }
    const limit = Number(limitRaw || 10000);
    const offset = Number(offsetRaw || 0);
    return this.federationSyncService.getInventoryMovementIds(
      storeId,
      dateFrom,
      dateTo,
      limit,
      offset,
    );
  }

  @Get('federation/session-ids')
  @UseGuards(FederationAuthGuard)
  async getFederationSessionIds(
    @Query('store_id') storeIdQuery: string,
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('limit') limitRaw: string,
    @Query('offset') offsetRaw: string,
    @Request() req: any,
  ): Promise<FederationIdsResult> {
    const storeId = storeIdQuery || req.user?.store_id;
    if (!storeId) throw new BadRequestException('store_id is required');
    return this.federationSyncService.getSessionIds(
      storeId,
      dateFrom,
      dateTo,
      limitRaw ? parseInt(limitRaw, 10) : 10000,
      offsetRaw ? parseInt(offsetRaw, 10) : 0,
    );
  }

  @Get('federation/debt-ids')
  @UseGuards(FederationAuthGuard)
  async getFederationDebtIds(
    @Query('store_id') storeIdQuery: string,
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('limit') limitRaw: string,
    @Query('offset') offsetRaw: string,
    @Request() req: any,
  ): Promise<FederationIdsResult> {
    const storeId = storeIdQuery || req.user?.store_id;
    if (!storeId) throw new BadRequestException('store_id is required');
    return this.federationSyncService.getDebtIds(
      storeId,
      dateFrom,
      dateTo,
      limitRaw ? parseInt(limitRaw, 10) : 10000,
      offsetRaw ? parseInt(offsetRaw, 10) : 0,
    );
  }

  @Get('federation/debt-payment-ids')
  @UseGuards(FederationAuthGuard)
  async getFederationDebtPaymentIds(
    @Query('store_id') storeIdQuery: string,
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('limit') limitRaw: string,
    @Query('offset') offsetRaw: string,
    @Request() req: any,
  ): Promise<FederationIdsResult> {
    const storeId = storeIdQuery || req.user?.store_id;
    if (!storeId) throw new BadRequestException('store_id is required');
    return this.federationSyncService.getDebtPaymentIds(
      storeId,
      dateFrom,
      dateTo,
      limitRaw ? parseInt(limitRaw, 10) : 10000,
      offsetRaw ? parseInt(offsetRaw, 10) : 0,
    );
  }

  @Get('federation/voided-sales-ids')
  @UseGuards(FederationAuthGuard)
  async getFederationVoidedSalesIds(
    @Query('store_id') storeIdQuery: string,
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('limit') limitRaw: string,
    @Query('offset') offsetRaw: string,
    @Request() req: any,
  ): Promise<FederationIdsResult> {
    const storeId = storeIdQuery || req.user?.store_id;
    if (!storeId) throw new BadRequestException('store_id is required');
    return this.federationSyncService.getVoidedSalesIds(
      storeId,
      dateFrom,
      dateTo,
      limitRaw ? parseInt(limitRaw, 10) : 10000,
      offsetRaw ? parseInt(offsetRaw, 10) : 0,
    );
  }

  @Post('federation/replay-sessions')
  @HttpCode(HttpStatus.OK)
  async replaySessions(
    @Body('session_ids') sessionIds: string[],
    @Request() req: any,
  ): Promise<FederationReplayResult> {
    const storeId = req.user.store_id;
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      throw new BadRequestException('session_ids es requerido');
    }
    return this.federationSyncService.replaySessionsByIds(storeId, sessionIds);
  }

  @Post('federation/replay-sales')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FederationAuthGuard)
  async replaySales(
    @Body('store_id') storeIdFromBody: string,
    @Body('sale_ids') saleIds: string[],
    @Request() req: any,
  ): Promise<FederationReplayResult> {
    const storeId = storeIdFromBody || req.user?.store_id;
    if (!storeId) throw new BadRequestException('store_id is required');
    return this.federationSyncService.replaySalesByIds(storeId, saleIds);
  }

  @Post('federation/replay-debts')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FederationAuthGuard)
  async replayDebts(
    @Body('store_id') storeIdFromBody: string,
    @Body('debt_ids') debtIds: string[],
    @Request() req: any,
  ): Promise<FederationReplayResult> {
    const storeId = storeIdFromBody || req.user?.store_id;
    if (!storeId) throw new BadRequestException('store_id is required');
    return this.federationSyncService.replayDebtsByIds(storeId, debtIds);
  }

  @Post('federation/replay-debt-payments')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FederationAuthGuard)
  async replayDebtPayments(
    @Body('store_id') storeIdFromBody: string,
    @Body('payment_ids') paymentIds: string[],
    @Request() req: any,
  ): Promise<FederationReplayResult> {
    const storeId = storeIdFromBody || req.user?.store_id;
    if (!storeId) throw new BadRequestException('store_id is required');
    return this.federationSyncService.replayDebtPaymentsByIds(
      storeId,
      paymentIds,
    );
  }

  @Post('federation/replay-inventory')
  @HttpCode(HttpStatus.OK)
  async replayInventory(
    @Body('movement_ids') movementIds: string[],
    @Body('product_ids') productIds: string[],
    @Request() req: any,
  ): Promise<FederationReplayInventoryResult> {
    const storeId = req.user.store_id;
    const safeMovementIds = Array.isArray(movementIds) ? movementIds : [];
    const safeProductIds = Array.isArray(productIds) ? productIds : [];

    if (safeMovementIds.length === 0 && safeProductIds.length === 0) {
      throw new BadRequestException('movement_ids o product_ids es requerido');
    }

    return this.federationSyncService.replayInventoryByFilter(
      storeId,
      safeMovementIds,
      safeProductIds,
    );
  }

  @Post('federation/auto-reconcile')
  @HttpCode(HttpStatus.OK)
  async autoReconcile(
    @Body('store_id') storeId: string,
  ): Promise<FederationAutoReconcileResult[]> {
    return this.federationSyncService.runAutoReconcile(storeId);
  }

  @Post('federation/reconcile-inventory-stock')
  @HttpCode(HttpStatus.OK)
  async reconcileInventoryStock(
    @Body('store_id') storeIdFromBody: string,
    @Request() req: any,
  ): Promise<InventoryStockReconcileResult> {
    const storeId = storeIdFromBody || req.user?.store_id;
    if (!storeId) {
      throw new BadRequestException('store_id es requerido');
    }
    return this.federationSyncService.reconcileInventoryStock(storeId);
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

  /**
   * Heal failed projections - Re-proyecta eventos que fallaron
   * Útil para reparar deudas y otros eventos que no se proyectaron correctamente
   */
  @Post('heal-projections')
  @HttpCode(HttpStatus.OK)
  async healProjections(
    @Body('store_id') storeId: string,
    @Body('limit') limitRaw: string,
  ): Promise<{
    processed: number;
    healed: number;
    stillFailing: number;
    errors: Array<{ eventId: string; type: string; error: string }>;
  }> {
    const limit = limitRaw ? parseInt(limitRaw, 10) : 100;
    return this.projectionsService.healFailedProjections(storeId, limit);
  }
}
