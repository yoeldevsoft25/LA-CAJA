import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Sale } from '../../../database/entities/sale.entity';
import { Debt, DebtStatus } from '../../../database/entities/debt.entity';
import { SaleItem } from '../../../database/entities/sale-item.entity';

export interface ReturnTotals {
  returnSubtotalBs: number;
  returnSubtotalUsd: number;
  returnDiscountBs: number;
  returnDiscountUsd: number;
  returnTotalBs: number;
  returnTotalUsd: number;
}

@Injectable()
export class SalesReturnFinancialService {
  roundTwo(value: number): number {
    return Math.round(value * 100) / 100;
  }

  calculateItemFinancials(saleItem: SaleItem, returnQty: number) {
    const unitPriceBs = Number(saleItem.unit_price_bs || 0);
    const unitPriceUsd = Number(saleItem.unit_price_usd || 0);
    const itemQty = Number(saleItem.qty) || 1;
    const perUnitDiscountBs =
      itemQty > 0 ? Number(saleItem.discount_bs || 0) / itemQty : 0;
    const perUnitDiscountUsd =
      itemQty > 0 ? Number(saleItem.discount_usd || 0) / itemQty : 0;

    const lineSubtotalBs = unitPriceBs * returnQty;
    const lineSubtotalUsd = unitPriceUsd * returnQty;
    const lineDiscountBs = perUnitDiscountBs * returnQty;
    const lineDiscountUsd = perUnitDiscountUsd * returnQty;
    const lineTotalBs = lineSubtotalBs - lineDiscountBs;
    const lineTotalUsd = lineSubtotalUsd - lineDiscountUsd;

    return {
      unitPriceBs,
      unitPriceUsd,
      lineSubtotalBs,
      lineSubtotalUsd,
      lineDiscountBs,
      lineDiscountUsd,
      lineTotalBs,
      lineTotalUsd,
    };
  }

  async updateSaleAndDebt(
    manager: EntityManager,
    sale: Sale,
    returnTotals: ReturnTotals,
  ): Promise<void> {
    const totals = sale.totals || {
      subtotal_bs: 0,
      subtotal_usd: 0,
      discount_bs: 0,
      discount_usd: 0,
      total_bs: 0,
      total_usd: 0,
    };

    const updatedSubtotalBs = Math.max(
      0,
      this.roundTwo(
        Number(totals.subtotal_bs || 0) -
          this.roundTwo(returnTotals.returnSubtotalBs),
      ),
    );
    const updatedSubtotalUsd = Math.max(
      0,
      this.roundTwo(
        Number(totals.subtotal_usd || 0) -
          this.roundTwo(returnTotals.returnSubtotalUsd),
      ),
    );
    const updatedDiscountBs = Math.max(
      0,
      this.roundTwo(
        Number(totals.discount_bs || 0) -
          this.roundTwo(returnTotals.returnDiscountBs),
      ),
    );
    const updatedDiscountUsd = Math.max(
      0,
      this.roundTwo(
        Number(totals.discount_usd || 0) -
          this.roundTwo(returnTotals.returnDiscountUsd),
      ),
    );
    const updatedTotalBs = Math.max(
      0,
      this.roundTwo(updatedSubtotalBs - updatedDiscountBs),
    );
    const updatedTotalUsd = Math.max(
      0,
      this.roundTwo(updatedSubtotalUsd - updatedDiscountUsd),
    );

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

    // Update Debt
    const debt = await manager.findOne(Debt, {
      where: { sale_id: sale.id, store_id: sale.store_id },
    });

    if (debt) {
      debt.amount_bs = updatedTotalBs;
      debt.amount_usd = updatedTotalUsd;
      debt.status = updatedTotalUsd <= 0 ? DebtStatus.PAID : DebtStatus.OPEN;
      await manager.save(Debt, debt);
    }
  }
}
