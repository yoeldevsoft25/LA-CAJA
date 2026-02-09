import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { VectorClockService } from './vector-clock.service';
import { CRDTService } from './crdt.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { CrdtSnapshotService } from './crdt-snapshot.service';
import { CrdtVerifyService } from './crdt-verify.service';
import { Event } from '../database/entities/event.entity';
import { ProjectionsModule } from '../projections/projections.module';
import { Product } from '../database/entities/product.entity';
import { CashSession } from '../database/entities/cash-session.entity';
import { DiscountsModule } from '../discounts/discounts.module';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { LicensesModule } from '../licenses/licenses.module';
import { ObservabilityModule } from '../observability/observability.module';
import { QueuesModule } from '../queues/queues.module';
import { CrdtSnapshot } from '../database/entities/crdt-snapshot.entity';
import { Store } from '../database/entities/store.entity';
import {
  FederationSyncService,
  FederationSyncProcessor,
} from './federation-sync.service';
import { InventoryEscrowModule } from '../inventory/escrow/inventory-escrow.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrphanHealerService } from './orphan-healer.service';
import { OutboxService } from './outbox.service';
import { DistributedLockService } from '../common/distributed-lock.service';
import { ConflictAuditService } from './conflict-audit.service';
import { FiscalModule } from '../fiscal/fiscal.module';
import { SplitBrainMonitorService } from './split-brain-monitor.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { FederationAlertsService } from './federation-alerts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      Product,
      CashSession,
      Store,
      CrdtSnapshot,
      WarehouseStock,
    ]),
    ProjectionsModule,
    DiscountsModule,
    QueuesModule,
    LicensesModule,
    ObservabilityModule,
    forwardRef(() => InventoryEscrowModule),
    forwardRef(() => InventoryModule),
    FiscalModule,
    NotificationsModule,
  ],
  controllers: [SyncController],
  providers: [
    SyncService,
    VectorClockService,
    CRDTService,
    ConflictResolutionService,
    FederationSyncService,
    FederationSyncProcessor,
    CrdtSnapshotService,
    CrdtVerifyService,
    OrphanHealerService,
    OutboxService,
    DistributedLockService,
    ConflictAuditService,
    SplitBrainMonitorService,
    FederationAlertsService,
  ],
  exports: [
    SyncService,
    FederationSyncService,
    CrdtSnapshotService,
    CrdtVerifyService,
    OutboxService,
    DistributedLockService,
    ConflictAuditService,
    SplitBrainMonitorService,
    FederationAlertsService,
  ],
})
export class SyncModule { }
