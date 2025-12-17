import { Injectable, BadRequestException } from '@nestjs/common';
import { ProductLot } from '../database/entities/product-lot.entity';

export interface LotAllocation {
  lot_id: string;
  quantity: number;
  unit_cost_bs: number;
  unit_cost_usd: number;
}

/**
 * Servicio con reglas de inventario (FIFO, etc.)
 */
@Injectable()
export class InventoryRulesService {
  /**
   * Obtiene la asignación de lotes para una venta usando FIFO
   * (First In, First Out - Primero en entrar, primero en salir)
   */
  getLotsForSale(
    productId: string,
    quantity: number,
    lots: ProductLot[],
  ): LotAllocation[] {
    // Filtrar solo lotes del producto con stock disponible
    const availableLots = lots.filter(
      (lot) =>
        lot.product_id === productId && lot.remaining_quantity > 0,
    );

    if (availableLots.length === 0) {
      throw new BadRequestException(
        `No hay lotes disponibles para el producto ${productId}`,
      );
    }

    // Ordenar por fecha de recepción (FIFO) - los más antiguos primero
    const sortedLots = availableLots.sort(
      (a, b) => a.received_at.getTime() - b.received_at.getTime(),
    );

    const allocations: LotAllocation[] = [];
    let remaining = quantity;

    for (const lot of sortedLots) {
      if (remaining <= 0) break;

      const allocated = Math.min(remaining, lot.remaining_quantity);
      allocations.push({
        lot_id: lot.id,
        quantity: allocated,
        unit_cost_bs: lot.unit_cost_bs,
        unit_cost_usd: lot.unit_cost_usd,
      });

      remaining -= allocated;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Stock insuficiente. Faltan ${remaining} unidades. Disponible: ${quantity - remaining}`,
      );
    }

    return allocations;
  }

  /**
   * Obtiene lotes próximos a vencer
   */
  getLotsExpiringSoon(
    lots: ProductLot[],
    daysAhead: number = 30,
  ): ProductLot[] {
    const today = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + daysAhead);

    return lots.filter((lot) => {
      if (!lot.expiration_date) return false;
      const expiration = new Date(lot.expiration_date);
      return (
        expiration >= today &&
        expiration <= thresholdDate &&
        lot.remaining_quantity > 0
      );
    });
  }

  /**
   * Obtiene lotes vencidos
   */
  getExpiredLots(lots: ProductLot[]): ProductLot[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return lots.filter((lot) => {
      if (!lot.expiration_date) return false;
      const expiration = new Date(lot.expiration_date);
      expiration.setHours(0, 0, 0, 0);
      return expiration < today && lot.remaining_quantity > 0;
    });
  }
}

