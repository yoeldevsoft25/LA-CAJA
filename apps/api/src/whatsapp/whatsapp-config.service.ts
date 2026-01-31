import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsAppConfig } from '../database/entities/whatsapp-config.entity';
import { CreateWhatsAppConfigDto } from './dto/create-whatsapp-config.dto';
import { UpdateWhatsAppConfigDto } from './dto/update-whatsapp-config.dto';
import { Sale } from '../database/entities/sale.entity';
import { Debt } from '../database/entities/debt.entity';
import { Customer } from '../database/entities/customer.entity';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de configuración de WhatsApp y formateo de mensajes
 */
@Injectable()
export class WhatsAppConfigService {
  private readonly logger = new Logger(WhatsAppConfigService.name);

  constructor(
    @InjectRepository(WhatsAppConfig)
    private whatsappConfigRepository: Repository<WhatsAppConfig>,
  ) { }

  /**
   * Obtiene la configuración de WhatsApp de una tienda
   */
  async findOne(storeId: string): Promise<WhatsAppConfig | null> {
    return this.whatsappConfigRepository.findOne({
      where: { store_id: storeId },
    });
  }

  /**
   * Crea o actualiza la configuración de WhatsApp de una tienda
   */
  async upsert(
    storeId: string,
    dto: CreateWhatsAppConfigDto,
  ): Promise<WhatsAppConfig> {
    const existing = await this.findOne(storeId);

    if (existing) {
      // Actualizar existente
      if (dto.whatsapp_number !== undefined)
        existing.whatsapp_number = dto.whatsapp_number || null;
      if (dto.thank_you_message !== undefined)
        existing.thank_you_message = dto.thank_you_message || null;
      if (dto.enabled !== undefined) existing.enabled = dto.enabled;
      if (dto.debt_notifications_enabled !== undefined)
        existing.debt_notifications_enabled = dto.debt_notifications_enabled;
      if (dto.debt_reminders_enabled !== undefined)
        existing.debt_reminders_enabled = dto.debt_reminders_enabled;

      return this.whatsappConfigRepository.save(existing);
    } else {
      // Crear nuevo
      const config = this.whatsappConfigRepository.create({
        id: randomUUID(),
        store_id: storeId,
        whatsapp_number: dto.whatsapp_number || null,
        thank_you_message: dto.thank_you_message || null,
        enabled: dto.enabled ?? false,
        debt_notifications_enabled: dto.debt_notifications_enabled ?? false,
        debt_reminders_enabled: dto.debt_reminders_enabled ?? false,
      });

      return this.whatsappConfigRepository.save(config);
    }
  }

  /**
   * Actualiza la configuración de WhatsApp
   */
  async update(
    storeId: string,
    dto: UpdateWhatsAppConfigDto,
  ): Promise<WhatsAppConfig> {
    const config = await this.findOne(storeId);

    if (!config) {
      throw new NotFoundException(
        'Configuración de WhatsApp no encontrada. Cree una configuración primero.',
      );
    }

    if (dto.whatsapp_number !== undefined)
      config.whatsapp_number = dto.whatsapp_number || null;
    if (dto.thank_you_message !== undefined)
      config.thank_you_message = dto.thank_you_message || null;
    if (dto.enabled !== undefined) config.enabled = dto.enabled;
    if (dto.debt_notifications_enabled !== undefined)
      config.debt_notifications_enabled = dto.debt_notifications_enabled;
    if (dto.debt_reminders_enabled !== undefined)
      config.debt_reminders_enabled = dto.debt_reminders_enabled;

    return this.whatsappConfigRepository.save(config);
  }

  /**
   * Formatea un mensaje de venta con detalles y mensaje de agradecimiento
   */
  formatSaleMessage(
    sale: Sale & { items?: any[]; customer?: Customer },
    config: WhatsAppConfig,
    storeName: string,
  ): string {
    const soldAt = new Date(sale.sold_at).toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const saleId = sale.id.slice(0, 8).toUpperCase();

    // Mensaje de agradecimiento personalizado
    let message = '';
    if (config.thank_you_message) {
      message = this.replaceVariables(config.thank_you_message, {
        storeName,
        customerName: sale.customer?.name || 'Cliente',
      });
      message += '\n\n';
    } else {
      message = `¡Gracias por comprar en ${storeName}!\n\n`;
    }

    // Detalles de la venta
    message += `🧾 *${storeName}*\n`;
    message += `📋 Venta #${saleId}\n`;
    message += `📅 ${soldAt}\n`;
    message += `\n`;

    // Items
    if (sale.items && sale.items.length > 0) {
      message += `*PRODUCTOS:*\n`;
      sale.items.forEach((item, index) => {
        const qty = item.is_weight_product
          ? `${Number(item.weight_value || item.qty).toFixed(2)} ${item.weight_unit || 'kg'}`
          : item.qty.toString();
        const unitPrice = item.is_weight_product
          ? Number(
            item.price_per_weight_usd ?? item.unit_price_usd,
          ).toFixed(2)
          : Number(item.unit_price_usd).toFixed(2);
        const lineTotal = (
          Number(item.qty) * Number(item.unit_price_usd) -
          Number(item.discount_usd || 0)
        ).toFixed(2);

        message += `${index + 1}. ${item.product?.name || 'Producto'}\n`;
        message += `   ${qty} x $${unitPrice} = $${lineTotal}\n`;
        if (Number(item.discount_usd || 0) > 0) {
          message += `   💰 Descuento: $${Number(item.discount_usd).toFixed(
            2,
          )}\n`;
        }
      });
      message += `\n`;
    }

    // Totales
    message += `*TOTALES:*\n`;
    message += `Total Bs: ${Number(sale.totals.total_bs).toFixed(2)}\n`;
    message += `Total USD: $${Number(sale.totals.total_usd).toFixed(2)}\n`;
    message += `Tasa: ${Number(sale.exchange_rate || 0).toFixed(2)}\n`;

    // Método de pago
    message += `\n`;
    message += `*PAGO:*\n`;
    const paymentMethodLabels: Record<string, string> = {
      CASH_BS: 'Efectivo Bs',
      CASH_USD: 'Efectivo USD',
      PAGO_MOVIL: 'Pago Móvil',
      TRANSFER: 'Tarjeta',
      ZELLE: 'Zelle',
      FIAO: 'Fiado',
      OTHER: 'Biopago',
    };
    message +=
      `${paymentMethodLabels[sale.payment.method] || sale.payment.method
      }\n`;

    // Cliente
    if (sale.customer) {
      message += `\n`;
      message += `*CLIENTE:*\n`;
      message += `${sale.customer.name || ''}\n`;
      if (sale.customer.document_id) {
        message += `Cédula: ${sale.customer.document_id}\n`;
      }
    }

    // Factura
    if ((sale as any).invoice_full_number) {
      message += `\n`;
      message += `📄 Factura: ${(sale as any).invoice_full_number}\n`;
    }

    return message;
  }

  /**
   * Formatea un mensaje de deuda creada
   */
  formatDebtMessage(
    debt: Debt & { customer?: Customer; sale?: Sale & { items?: any[] } },
    config: WhatsAppConfig,
    storeName: string,
  ): string {
    const debtId = debt.id.slice(0, 8).toUpperCase();
    const debtDate = new Date(debt.created_at).toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    let message = `💳 *${storeName}*\n`;
    message += `📋 Nueva Deuda Registrada\n`;
    message += `\n`;
    message += `*CLIENTE:*\n`;
    message += `${debt.customer?.name || 'Cliente'}\n`;
    if (debt.customer?.document_id) {
      message += `Cédula: ${debt.customer.document_id}\n`;
    }
    message += `\n`;
    message += `*DETALLES DE LA DEUDA:*\n`;
    message += `ID: #${debtId}\n`;
    message += `Fecha: ${debtDate}\n`;
    message += `Monto: $${Number(debt.amount_usd).toFixed(2)} USD\n`;
    message += `Monto: ${Number(debt.amount_bs).toFixed(2)} Bs\n`;
    message += `Estado: ${debt.status === 'open' ? 'Abierta' : debt.status === 'partial' ? 'Parcial' : 'Pagada'}\n`;

    if (debt.sale) {
      message += `\n`;
      message += `*VENTA ASOCIADA:*\n`;
      message += `ID: #${debt.sale.id.slice(0, 8).toUpperCase()}\n`;

      // Incluir artículos de la venta si están disponibles
      if (debt.sale.items && debt.sale.items.length > 0) {
        message += `\n`;
        message += `*ARTÍCULOS DE LA COMPRA:*\n`;
        debt.sale.items.forEach((item, index) => {
          const qty = item.is_weight_product
            ? `${Number(item.weight_value || item.qty).toFixed(2)} ${item.weight_unit || 'kg'}`
            : item.qty.toString();
          const unitPrice = item.is_weight_product
            ? Number(
              item.price_per_weight_usd ?? item.unit_price_usd,
            ).toFixed(2)
            : Number(item.unit_price_usd).toFixed(2);
          const lineTotal = (
            Number(item.qty) * Number(item.unit_price_usd) -
            Number(item.discount_usd || 0)
          ).toFixed(2);

          const productName = item.product?.name || 'Producto';
          const variantName = item.variant?.variant_value
            ? ` - ${item.variant.variant_type}: ${item.variant.variant_value}`
            : '';

          message += `${index + 1}. ${productName}${variantName}\n`;
          message += `   ${qty} x $${unitPrice} = $${lineTotal}\n`;
          if (Number(item.discount_usd || 0) > 0) {
            message += `   💰 Descuento: $${Number(item.discount_usd).toFixed(2)}\n`;
          }
        });
      }
    }

    return message;
  }

  /**
   * Formatea un mensaje de recordatorio de deudas pendientes
   */
  formatDebtReminderMessage(
    debts: (Debt & { customer?: Customer; payments?: any[]; sale?: Sale & { items?: any[] } })[],
    customer: Customer,
    config: WhatsAppConfig,
    storeName: string,
  ): string {
    const activeDebts = debts.filter((d) => d.status !== 'paid');

    if (activeDebts.length === 0) {
      return `💳 *${storeName}*\n📋 Estado de Fiados\n\n*CLIENTE:*\n${customer.name}${customer.document_id ? `\nCédula: ${customer.document_id}` : ''}${customer.phone ? `\nTeléfono: ${customer.phone}` : ''}\n\n✅ *Sin deudas pendientes*`;
    }

    // Calcular totales
    let totalDebtUsd = 0;
    let totalPaidUsd = 0;
    let totalRemainingUsd = 0;

    activeDebts.forEach((debt) => {
      const totalPaid = (debt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount_usd || 0),
        0,
      );
      totalDebtUsd += Number(debt.amount_usd);
      totalPaidUsd += totalPaid;
      totalRemainingUsd += Number(debt.amount_usd) - totalPaid;
    });

    let message = `💳 *${storeName}*\n`;
    message += `📋 Recordatorio de Fiados\n`;
    message += `\n`;
    message += `*CLIENTE:*\n`;
    message += `${customer.name}\n`;

    if (customer.document_id) {
      message += `Cédula: ${customer.document_id}\n`;
    }

    if (customer.phone) {
      message += `Teléfono: ${customer.phone}\n`;
    }

    message += `\n`;
    message += `*DEUDAS PENDIENTES:*\n`;
    message += `\n`;

    // Listar cada deuda activa
    activeDebts.forEach((debt, index) => {
      const totalPaid = (debt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount_usd || 0),
        0,
      );
      const remaining = Number(debt.amount_usd) - totalPaid;
      const debtId = debt.id.slice(0, 8).toUpperCase();
      const debtDate = new Date(debt.created_at).toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const emoji =
        index === 0 ? '1️⃣' : index === 1 ? '2️⃣' : index === 2 ? '3️⃣' : `${index + 1}.`;

      message += `${emoji} Deuda #${debtId}\n`;
      message += `   📅 Fecha: ${debtDate}\n`;
      message += `   💵 Monto: $${Number(debt.amount_usd).toFixed(2)}\n`;
      message += `   ✅ Abonado: $${totalPaid.toFixed(2)}\n`;
      message += `   ⏳ Pendiente: $${remaining.toFixed(2)}\n`;

      // Incluir artículos de la venta si están disponibles
      if (debt.sale?.items && debt.sale.items.length > 0) {
        message += `   \n`;
        message += `   *Artículos:*\n`;
        debt.sale.items.forEach((item, itemIndex) => {
          const qty = item.is_weight_product
            ? `${Number(item.weight_value || item.qty).toFixed(2)} ${item.weight_unit || 'kg'}`
            : item.qty.toString();
          const unitPrice = item.is_weight_product
            ? Number(
              item.price_per_weight_usd ?? item.unit_price_usd,
            ).toFixed(2)
            : Number(item.unit_price_usd).toFixed(2);
          const lineTotal = (
            Number(item.qty) * Number(item.unit_price_usd) -
            Number(item.discount_usd || 0)
          ).toFixed(2);

          const productName = item.product?.name || 'Producto';
          const variantName = item.variant?.variant_value
            ? ` - ${item.variant.variant_type}: ${item.variant.variant_value}`
            : '';

          message += `   ${itemIndex + 1}. ${productName}${variantName}\n`;
          message += `      ${qty} x $${unitPrice} = $${lineTotal}\n`;
        });
      }

      if (index < activeDebts.length - 1) {
        message += `\n`;
      }
    });

    message += `\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `*RESUMEN:*\n`;
    message += `Total Fiado: $${totalDebtUsd.toFixed(2)}\n`;
    message += `Total Abonado: $${totalPaidUsd.toFixed(2)}\n`;
    message += `💰 Total Pendiente: $${totalRemainingUsd.toFixed(2)}\n`;
    message += `━━━━━━━━━━━━━━━━`;

    return message;
  }

  /**
   * Formatea un mensaje personalizado para un cliente
   */
  formatCustomerMessage(
    customer: Customer,
    customMessage: string,
    config: WhatsAppConfig,
    storeName: string,
  ): string {
    let message = this.replaceVariables(customMessage, {
      storeName,
      customerName: customer.name,
    });

    return message;
  }

  /**
   * Reemplaza variables en un mensaje
   */
  private replaceVariables(
    message: string,
    variables: Record<string, string>,
  ): string {
    let result = message;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    });
    return result;
  }
}
