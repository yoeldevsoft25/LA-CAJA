import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { VoidSaleCommand } from './void-sale.command';
import { Sale } from '../../../../database/entities/sale.entity';
import { FiscalInvoice } from '../../../../database/entities/fiscal-invoice.entity';
import { Debt } from '../../../../database/entities/debt.entity';
import { DebtPayment } from '../../../../database/entities/debt-payment.entity';
import { SaleItem } from '../../../../database/entities/sale-item.entity';
import { InventoryMovement } from '../../../../database/entities/inventory-movement.entity';
import { ProductLot } from '../../../../database/entities/product-lot.entity';
import { LotMovement } from '../../../../database/entities/lot-movement.entity';
import { ProductSerial } from '../../../../database/entities/product-serial.entity';
import { WarehousesService } from '../../../../warehouses/warehouses.service';
import { randomUUID } from 'crypto';
import { AccountingService } from '../../../../accounting/accounting.service';
import { JournalEntry } from '../../../../database/entities/journal-entry.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../../../../database/entities/event.entity';
import { FederationSyncService } from '../../../../sync/federation-sync.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';

@CommandHandler(VoidSaleCommand)
export class VoidSaleHandler implements ICommandHandler<VoidSaleCommand> {
  private readonly logger = new Logger(VoidSaleHandler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly warehousesService: WarehousesService,
    private readonly accountingService: AccountingService,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly federationSyncService: FederationSyncService,
    @InjectQueue('federation-sync')
    private readonly federationSyncQueue: Queue,
  ) { }

  async execute(command: VoidSaleCommand): Promise<Sale> {
    const { storeId, saleId, userId, reason } = command;

    const savedSale = await this.dataSource.transaction(async (manager: EntityManager) => {
      const sale = await manager.findOne(Sale, {
        where: { id: saleId, store_id: storeId },
        relations: ['items'],
      });

      if (!sale) {
        throw new NotFoundException('Venta no encontrada');
      }

      if (sale.voided_at) {
        throw new BadRequestException('La venta ya fue anulada');
      }

      // Verificar facturas fiscales asociadas a la venta
      const fiscalInvoices = await manager.find(FiscalInvoice, {
        where: { sale_id: saleId, store_id: storeId },
      });

      // Buscar si hay una factura emitida (no nota de crédito)
      const issuedInvoice = fiscalInvoices.find(
        (inv) => inv.invoice_type === 'invoice' && inv.status === 'issued',
      );

      if (issuedInvoice) {
        // Si hay factura emitida, verificar si existe una nota de crédito emitida que la anule
        const issuedCreditNote = fiscalInvoices.find(
          (inv) =>
            inv.invoice_type === 'credit_note' && inv.status === 'issued',
        );

        if (!issuedCreditNote) {
          throw new BadRequestException(
            'La venta tiene una factura fiscal emitida. Debe crear y emitir una nota de crédito antes de anular la venta.',
          );
        }
      }

      const debt = await manager.findOne(Debt, {
        where: { sale_id: saleId, store_id: storeId },
      });
      if (debt) {
        const paymentsCount = await manager.count(DebtPayment, {
          where: { debt_id: debt.id },
        });
        if (paymentsCount > 0) {
          throw new BadRequestException(
            'La venta tiene pagos asociados. Debes reversar los pagos antes de anular.',
          );
        }
        await manager.delete(DebtPayment, { debt_id: debt.id });
        await manager.delete(Debt, { id: debt.id });
      }

      const saleItems =
        sale.items?.length > 0
          ? sale.items
          : await manager.find(SaleItem, { where: { sale_id: saleId } });

      const saleMovements = await manager
        .createQueryBuilder(InventoryMovement, 'movement')
        .where('movement.store_id = :storeId', { storeId })
        .andWhere("movement.ref ->> 'sale_id' = :saleId", { saleId })
        .getMany();

      const warehouseByItemKey = new Map<string, string | null>();
      for (const movement of saleMovements) {
        const key = `${movement.product_id}:${movement.variant_id || 'null'}`;
        if (!warehouseByItemKey.has(key)) {
          warehouseByItemKey.set(key, movement.warehouse_id || null);
        }
      }

      const now = new Date();
      const reasonNote = reason
        ? `Devolución venta ${saleId}: ${reason}`
        : `Devolución venta ${saleId}`;

      for (const item of saleItems) {
        if (item.lot_id) {
          const lot = await manager.findOne(ProductLot, {
            where: { id: item.lot_id },
          });
          if (lot) {
            lot.remaining_quantity =
              Number(lot.remaining_quantity) + Number(item.qty);
            lot.updated_at = now;
            await manager.save(ProductLot, lot);

            const lotMovement = manager.create(LotMovement, {
              id: randomUUID(),
              lot_id: lot.id,
              movement_type: 'adjusted',
              qty_delta: item.qty,
              happened_at: now,
              sale_id: saleId,
              note: reasonNote,
            });
            await manager.save(LotMovement, lotMovement);
          }
        }

        const key = `${item.product_id}:${item.variant_id || 'null'}`;
        const warehouseId = warehouseByItemKey.get(key) || null;

        const movement = manager.create(InventoryMovement, {
          id: randomUUID(),
          store_id: storeId,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          movement_type: 'adjust',
          qty_delta: item.qty,
          unit_cost_bs: 0,
          unit_cost_usd: 0,
          warehouse_id: warehouseId,
          note: reasonNote,
          ref: { sale_id: saleId, reversal: true, warehouse_id: warehouseId },
          happened_at: now,
          approved: true,
        });
        await manager.save(InventoryMovement, movement);

        if (warehouseId) {
          await this.warehousesService.updateStock(
            warehouseId,
            item.product_id,
            item.variant_id || null,
            item.qty,
            storeId,
          );
        }
      }

      await manager.getRepository(ProductSerial).update(
        { sale_id: saleId },
        {
          status: 'returned',
          sale_id: null,
          sale_item_id: null,
          sold_at: null,
          updated_at: now,
        },
      );

      sale.voided_at = now;
      sale.voided_by_user_id = userId;
      sale.void_reason = reason || null;

      const savedSale = await manager.save(Sale, sale);

      // 8. Anular asientos contables asociados
      try {
        const entries = await this.accountingService.findEntriesBySale(
          storeId,
          saleId,
          manager,
        );

        for (const entry of entries) {
          if (entry.status !== 'cancelled') {
            this.logger.log(
              `Anulando asiento contable ${entry.entry_number} por anulación de venta ${saleId}`,
            );
            await this.accountingService.cancelEntry(
              storeId,
              entry.id,
              userId,
              reason || 'Anulación de venta',
              manager,
            );
          }
        }
      } catch (error) {
        // Loguear error pero no revertir la anulación de la venta si falla lo contable
        // (aunque al estar en la misma transacción, si cancelEntry lanza error, fallará todo)
        this.logger.error(
          `Error al intentar anular el asiento contable de la venta ${saleId}:`,
          error instanceof Error ? error.stack : String(error),
        );
        throw error; // Re-lanzar para asegurar atomicidad de la transacción
      }

      return savedSale;
    });

    // Enviar evento de anulación a la federación
    try {
      const serverDeviceId = '00000000-0000-0000-0000-000000000001';
      const eventSeq = Date.now();

      const voidPayload = {
        sale_id: saleId,
        voided_at: new Date().getTime(),
        voided_by_user_id: userId,
        reason: reason || null,
      };

      const hashPayload = (payload: any): string => {
        const json = JSON.stringify(payload, Object.keys(payload).sort());
        return crypto.createHash('sha256').update(json).digest('hex');
      };

      const voidEvent = this.eventRepository.create({
        event_id: randomUUID(),
        store_id: storeId,
        device_id: serverDeviceId,
        seq: eventSeq,
        type: 'SaleVoided',
        version: 1,
        created_at: new Date(),
        actor_user_id: userId || null,
        actor_role: 'owner', // Solo owners pueden anular según controller
        payload: voidPayload,
        vector_clock: { [serverDeviceId]: eventSeq },
        causal_dependencies: [],
        delta_payload: voidPayload,
        full_payload_hash: hashPayload(voidPayload),
      });

      await this.eventRepository.save(voidEvent);

      const queuesEnabled =
        process.env.QUEUES_ENABLED?.toLowerCase() !== 'false' &&
        process.env.QUEUES_DISABLED?.toLowerCase() !== 'true';

      if (queuesEnabled) {
        await this.federationSyncQueue.add(
          'relay-event',
          {
            eventId: voidEvent.event_id,
            storeId: voidEvent.store_id,
            deviceId: voidEvent.device_id,
          },
          {
            jobId: `relay-${voidEvent.event_id}`,
            attempts: 10,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
          },
        );
      } else {
        await this.federationSyncService.queueRelay(voidEvent);
      }
    } catch (error) {
      this.logger.error(
        `Error al emitir evento SaleVoided para venta ${saleId}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return savedSale;
  }
}
