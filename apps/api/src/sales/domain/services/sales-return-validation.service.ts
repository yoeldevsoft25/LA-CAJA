import { Injectable, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Sale } from '../../../database/entities/sale.entity';
import { FiscalInvoice } from '../../../database/entities/fiscal-invoice.entity';
import { Debt } from '../../../database/entities/debt.entity';
import { DebtPayment } from '../../../database/entities/debt-payment.entity';
import { SaleItem } from '../../../database/entities/sale-item.entity';
import { ProductSerial } from '../../../database/entities/product-serial.entity';
import { ReturnItemInput } from './sales-return-domain.service';

@Injectable()
export class SalesReturnValidationService {
  async validateSaleForReturn(
    manager: EntityManager,
    sale: Sale,
    storeId: string,
  ): Promise<void> {
    if (sale.voided_at) {
      throw new BadRequestException('La venta está anulada');
    }

    // Fiscal validation
    const fiscalInvoices = await manager.find(FiscalInvoice, {
      where: { sale_id: sale.id, store_id: storeId },
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

    // Debt validation
    const debt = await manager.findOne(Debt, {
      where: { sale_id: sale.id, store_id: storeId },
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
  }

  async validateItemForReturn(
    manager: EntityManager,
    saleItem: SaleItem,
    inputItem: ReturnItemInput,
    alreadyReturned: number,
  ): Promise<void> {
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

    const remainingQty = Number(saleItem.qty) - alreadyReturned;
    if (returnQty > remainingQty + 0.0001) {
      throw new BadRequestException(
        `Cantidad a devolver excede lo disponible. Disponible: ${remainingQty}`,
      );
    }

    // Process Serials validations
    const serialsCount = await manager.count(ProductSerial, {
      where: { sale_item_id: saleItem.id },
    });

    if (serialsCount > 0) {
      const inputSerialIds = inputItem.serial_ids || [];
      if (inputSerialIds.length === 0) {
        throw new BadRequestException(
          'Debes especificar los seriales a devolver',
        );
      }
      if (inputSerialIds.length !== returnQty) {
        throw new BadRequestException(
          'La cantidad de seriales debe coincidir con la cantidad devuelta',
        );
      }
    }
  }
}
