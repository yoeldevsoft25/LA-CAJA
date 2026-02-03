import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Sale } from '../../../database/entities/sale.entity';
import { SaleItem } from '../../../database/entities/sale-item.entity';
import { FiscalInvoice } from '../../../database/entities/fiscal-invoice.entity';
import { Debt, DebtStatus } from '../../../database/entities/debt.entity';
import { DebtPayment } from '../../../database/entities/debt-payment.entity';
import { SaleReturn } from '../../../database/entities/sale-return.entity';
import { SaleReturnItem } from '../../../database/entities/sale-return-item.entity';
import { InventoryMovement } from '../../../database/entities/inventory-movement.entity';
import { ProductLot } from '../../../database/entities/product-lot.entity';
import { LotMovement } from '../../../database/entities/lot-movement.entity';
import { ProductSerial } from '../../../database/entities/product-serial.entity';
import { WarehousesService } from '../../../warehouses/warehouses.service';
import { randomUUID } from 'crypto';

export interface ReturnItemInput {
    sale_item_id: string;
    qty: number;
    serial_ids?: string[];
    note?: string;
}

@Injectable()
export class SalesReturnDomainService {
    private readonly logger = new Logger(SalesReturnDomainService.name);

    constructor(private readonly warehousesService: WarehousesService) { }

    async processReturn(
        manager: EntityManager,
        storeId: string,
        saleId: string,
        userId: string,
        items: ReturnItemInput[],
        reason?: string,
    ): Promise<SaleReturn> {
        if (!items || items.length === 0) {
            throw new BadRequestException('Debes especificar items a devolver');
        }

        const roundTwo = (value: number) => Math.round(value * 100) / 100;

        // 1. Fetch sale with items
        const sale = await manager.findOne(Sale, {
            where: { id: saleId, store_id: storeId },
            relations: ['items'],
        });

        if (!sale) {
            throw new NotFoundException('Venta no encontrada');
        }

        if (sale.voided_at) {
            throw new BadRequestException('La venta está anulada');
        }

        // 2. Fiscal validation
        const fiscalInvoices = await manager.find(FiscalInvoice, {
            where: { sale_id: saleId, store_id: storeId },
        });

        const issuedInvoice = fiscalInvoices.find(
            (inv) => inv.invoice_type === 'invoice' && inv.status === 'issued',
        );

        if (issuedInvoice) {
            const issuedCreditNote = fiscalInvoices.find(
                (inv) => inv.invoice_type === 'credit_note' && inv.status === 'issued',
            );

            if (!issuedCreditNote) {
                throw new BadRequestException(
                    'La venta tiene una factura fiscal emitida. Debe crear y emitir una nota de crédito antes de realizar la devolución.',
                );
            }
        }

        // 3. Debt validation
        const debt = await manager.findOne(Debt, {
            where: { sale_id: saleId, store_id: storeId },
        });
        if (debt) {
            const paymentsCount = await manager.count(DebtPayment, {
                where: { debt_id: debt.id },
            });
            if (paymentsCount > 0) {
                throw new BadRequestException(
                    'La venta tiene pagos asociados. Debes reversar los pagos antes de la devolución.',
                );
            }
        }

        const saleItems =
            sale.items?.length > 0
                ? sale.items
                : await manager.find(SaleItem, { where: { sale_id: saleId } });

        const saleItemById = new Map(saleItems.map((item) => [item.id, item]));

        // 4. Get already returned quantities
        const saleItemIds = saleItems.map((item) => item.id);
        const existingReturns = saleItemIds.length
            ? await manager
                .createQueryBuilder(SaleReturnItem, 'return_item')
                .select('return_item.sale_item_id', 'sale_item_id')
                .addSelect('SUM(return_item.qty)', 'returned_qty')
                .where('return_item.sale_item_id IN (:...saleItemIds)', {
                    saleItemIds,
                })
                .groupBy('return_item.sale_item_id')
                .getRawMany()
            : [];

        const returnedQtyByItem = new Map<string, number>();
        for (const row of existingReturns) {
            returnedQtyByItem.set(row.sale_item_id, parseFloat(row.returned_qty) || 0);
        }

        // 5. Get original movements for warehouse mapping
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

        const defaultWarehouse = await this.warehousesService.getDefaultOrFirst(storeId);
        const returnId = randomUUID();
        const now = new Date();

        let returnSubtotalBs = 0;
        let returnSubtotalUsd = 0;
        let returnDiscountBs = 0;
        let returnDiscountUsd = 0;
        let returnTotalBs = 0;
        let returnTotalUsd = 0;

        const returnItemsList: SaleReturnItem[] = [];

        // 6. Process items
        for (const inputItem of items) {
            const saleItem = saleItemById.get(inputItem.sale_item_id);
            if (!saleItem) {
                throw new BadRequestException(`Item ${inputItem.sale_item_id} no pertenece a la venta`);
            }

            const returnQty = Number(inputItem.qty);
            if (!Number.isFinite(returnQty) || returnQty <= 0) {
                throw new BadRequestException('Cantidad inválida para devolución');
            }

            const isWeightProduct = Boolean(saleItem.is_weight_product);
            if (!isWeightProduct && !Number.isInteger(returnQty)) {
                throw new BadRequestException(
                    'La cantidad devuelta debe ser entera para productos no pesados',
                );
            }

            const alreadyReturned = returnedQtyByItem.get(saleItem.id) || 0;
            const remainingQty = Number(saleItem.qty) - alreadyReturned;
            if (returnQty > remainingQty + 0.0001) {
                throw new BadRequestException(
                    `Cantidad a devolver excede lo disponible. Disponible: ${remainingQty}`,
                );
            }

            // Process Serials
            const serialsForItem = await manager.find(ProductSerial, {
                where: { sale_item_id: saleItem.id },
            });

            if (serialsForItem.length > 0) {
                const inputSerialIds = inputItem.serial_ids || [];
                if (inputSerialIds.length === 0) {
                    throw new BadRequestException('Debes especificar los seriales a devolver');
                }
                if (inputSerialIds.length !== returnQty) {
                    throw new BadRequestException(
                        'La cantidad de seriales debe coincidir con la cantidad devuelta',
                    );
                }

                const serialsToReturn = await manager.find(ProductSerial, {
                    where: { id: In(inputSerialIds) },
                });

                if (serialsToReturn.length !== inputSerialIds.length) {
                    throw new BadRequestException('No se encontraron todos los seriales especificados');
                }

                for (const serial of serialsToReturn) {
                    if (serial.sale_item_id !== saleItem.id || serial.status !== 'sold') {
                        throw new BadRequestException(
                            `El serial ${serial.id} no pertenece a esta venta o no está vendido`,
                        );
                    }

                    serial.status = 'returned';
                    serial.sale_id = null;
                    serial.sale_item_id = null;
                    serial.sold_at = null;
                    serial.updated_at = now;
                    await manager.save(ProductSerial, serial);
                }
            }

            // Process Lots
            if (saleItem.lot_id) {
                const lot = await manager.findOne(ProductLot, {
                    where: { id: saleItem.lot_id },
                });
                if (lot) {
                    lot.remaining_quantity = Number(lot.remaining_quantity) + Number(returnQty);
                    lot.updated_at = now;
                    await manager.save(ProductLot, lot);

                    const lotMovement = manager.create(LotMovement, {
                        id: randomUUID(),
                        lot_id: lot.id,
                        movement_type: 'adjusted',
                        qty_delta: returnQty,
                        happened_at: now,
                        sale_id: saleId,
                        note: inputItem.note || reason || `Devolución ${saleId}`,
                    });
                    await manager.save(LotMovement, lotMovement);
                }
            }

            // Inventory Stock
            const key = `${saleItem.product_id}:${saleItem.variant_id || 'null'}`;
            const warehouseId = warehouseByItemKey.get(key) || defaultWarehouse.id;

            const movement = manager.create(InventoryMovement, {
                id: randomUUID(),
                store_id: storeId,
                product_id: saleItem.product_id,
                variant_id: saleItem.variant_id || null,
                movement_type: 'adjust',
                qty_delta: returnQty,
                unit_cost_bs: 0,
                unit_cost_usd: 0,
                warehouse_id: warehouseId,
                note: inputItem.note || reason || `Devolución ${saleId}`,
                ref: {
                    sale_id: saleId,
                    sale_item_id: saleItem.id,
                    return_id: returnId,
                    return: true,
                    warehouse_id: warehouseId,
                },
                happened_at: now,
                approved: true,
                requested_by: userId,
                approved_by: userId,
                approved_at: now,
            });
            await manager.save(InventoryMovement, movement);

            if (warehouseId) {
                await this.warehousesService.updateStock(
                    warehouseId,
                    saleItem.product_id,
                    saleItem.variant_id || null,
                    returnQty,
                    storeId,
                    manager,
                );
            }

            // Financials
            const unitPriceBs = Number(saleItem.unit_price_bs || 0);
            const unitPriceUsd = Number(saleItem.unit_price_usd || 0);
            const itemQty = Number(saleItem.qty) || 1;
            const perUnitDiscountBs = itemQty > 0 ? Number(saleItem.discount_bs || 0) / itemQty : 0;
            const perUnitDiscountUsd = itemQty > 0 ? Number(saleItem.discount_usd || 0) / itemQty : 0;

            const lineSubtotalBs = unitPriceBs * returnQty;
            const lineSubtotalUsd = unitPriceUsd * returnQty;
            const lineDiscountBs = perUnitDiscountBs * returnQty;
            const lineDiscountUsd = perUnitDiscountUsd * returnQty;
            const lineTotalBs = lineSubtotalBs - lineDiscountBs;
            const lineTotalUsd = lineSubtotalUsd - lineDiscountUsd;

            returnSubtotalBs += lineSubtotalBs;
            returnSubtotalUsd += lineSubtotalUsd;
            returnDiscountBs += lineDiscountBs;
            returnDiscountUsd += lineDiscountUsd;
            returnTotalBs += lineTotalBs;
            returnTotalUsd += lineTotalUsd;

            const returnItem = manager.create(SaleReturnItem, {
                id: randomUUID(),
                return_id: returnId,
                sale_item_id: saleItem.id,
                product_id: saleItem.product_id,
                variant_id: saleItem.variant_id || null,
                lot_id: saleItem.lot_id || null,
                qty: returnQty,
                unit_price_bs: unitPriceBs,
                unit_price_usd: unitPriceUsd,
                discount_bs: roundTwo(lineDiscountBs),
                discount_usd: roundTwo(lineDiscountUsd),
                total_bs: roundTwo(lineTotalBs),
                total_usd: roundTwo(lineTotalUsd),
                serial_ids: inputItem.serial_ids || null,
                note: inputItem.note || null,
            });

            returnItemsList.push(returnItem);
        }

        // 7. Update Sale Totals
        const totals = sale.totals || {
            subtotal_bs: 0,
            subtotal_usd: 0,
            discount_bs: 0,
            discount_usd: 0,
            total_bs: 0,
            total_usd: 0,
        };

        const updatedSubtotalBs = Math.max(0, roundTwo(Number(totals.subtotal_bs || 0) - roundTwo(returnSubtotalBs)));
        const updatedSubtotalUsd = Math.max(0, roundTwo(Number(totals.subtotal_usd || 0) - roundTwo(returnSubtotalUsd)));
        const updatedDiscountBs = Math.max(0, roundTwo(Number(totals.discount_bs || 0) - roundTwo(returnDiscountBs)));
        const updatedDiscountUsd = Math.max(0, roundTwo(Number(totals.discount_usd || 0) - roundTwo(returnDiscountUsd)));
        const updatedTotalBs = Math.max(0, roundTwo(updatedSubtotalBs - updatedDiscountBs));
        const updatedTotalUsd = Math.max(0, roundTwo(updatedSubtotalUsd - updatedDiscountUsd));

        sale.totals = {
            ...totals,
            subtotal_bs: updatedSubtotalBs,
            subtotal_usd: updatedSubtotalUsd,
            discount_bs: updatedDiscountBs,
            discount_usd: updatedDiscountUsd,
            total_bs: updatedTotalBs,
            total_usd: updatedTotalUsd,
        };
        await manager.save(Sale, sale);

        // 8. Update Debt
        if (debt) {
            debt.amount_bs = updatedTotalBs;
            debt.amount_usd = updatedTotalUsd;
            debt.status = updatedTotalUsd <= 0 ? DebtStatus.PAID : DebtStatus.OPEN;
            await manager.save(Debt, debt);
        }

        // 9. Create Sale Return Header
        const saleReturn = manager.create(SaleReturn, {
            id: returnId,
            store_id: storeId,
            sale_id: saleId,
            created_by: userId,
            reason: reason || null,
            total_bs: roundTwo(returnTotalBs),
            total_usd: roundTwo(returnTotalUsd),
        });

        const savedReturn = await manager.save(SaleReturn, saleReturn);
        await manager.save(SaleReturnItem, returnItemsList);
        savedReturn.items = returnItemsList;

        return savedReturn;
    }
}
