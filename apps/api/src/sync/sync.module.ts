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
import { OrphanHealerService } from './orphan-healer.service';
import { OutboxService } from './outbox.service';
import { DistributedLockService } from '../common/distributed-lock.service';
import { ConflictAuditService } from './conflict-audit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      Product,
      CashSession,
      Store,
      CrdtSnapshot,
    ]),
    ProjectionsModule,
    DiscountsModule,
    QueuesModule,
    LicensesModule,
    ObservabilityModule,
    forwardRef(() => InventoryEscrowModule),
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
  ],
  exports: [
    SyncService,
    FederationSyncService,
    CrdtSnapshotService,
    CrdtVerifyService,
    OutboxService,
    DistributedLockService,
    ConflictAuditService,
  ],
})
export class SyncModule { }
