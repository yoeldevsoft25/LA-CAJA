import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { WhatsAppConfigService } from './whatsapp-config.service';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { WhatsAppMessageQueue } from '../database/entities/whatsapp-message-queue.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { Customer } from '../database/entities/customer.entity';
import { Store } from '../database/entities/store.entity';
import { randomUUID } from 'crypto';

/**
 * Servicio reutilizable para enviar mensajes de WhatsApp
 * Soporta ventas, deudas, recordatorios y mensajes personalizados
 */
@Injectable()
export class WhatsAppMessagingService {
  private readonly logger = new Logger(WhatsAppMessagingService.name);

  constructor(
    @InjectRepository(WhatsAppMessageQueue)
    private messageQueueRepository: Repository<WhatsAppMessageQueue>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    private whatsappConfigService: WhatsAppConfigService,
    private whatsappBotService: WhatsAppBotService,
    private dataSource: DataSource,
  ) {}

  /**
   * Agrega un mensaje genérico a la cola
   */
  async queueMessage(
    storeId: string,
    messageType: 'sale' | 'debt' | 'debt_reminder' | 'customer' | 'custom',
    phone: string,
    message: string,
    referenceId?: string,
    scheduledFor?: Date,
    deviceId?: string,
    seq?: number,
  ): Promise<WhatsAppMessageQueue> {
    const queuedMessage = this.messageQueueRepository.create({
      id: randomUUID(),
      store_id: storeId,
      message_type: messageType,
      reference_id: referenceId || null,
      customer_phone: phone,
      message,
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
      scheduled_for: scheduledFor || null,
      device_id: deviceId || null,
      seq: seq || null,
    });

    return this.messageQueueRepository.save(queuedMessage);
  }

  /**
   * Envía notificación de venta
   */
  async sendSaleNotification(
    storeId: string,
    saleId: string,
    deviceId?: string,
    seq?: number,
  ): Promise<{ queued: boolean; error?: string }> {
    try {
      // Verificar configuración
      const config = await this.whatsappConfigService.findOne(storeId);
      if (!config || !config.enabled) {
        return {
          queued: false,
          error: 'WhatsApp no está habilitado para esta tienda',
        };
      }

      // Obtener venta con relaciones
      const sale = await this.saleRepository.findOne({
        where: { id: saleId, store_id: storeId },
        relations: ['customer'],
      });

      if (!sale) {
        return { queued: false, error: 'Venta no encontrada' };
      }

      // Verificar si tiene cliente con teléfono
      if (!sale.customer_id || !sale.customer?.phone) {
        return {
          queued: false,
          error: 'La venta no tiene cliente con teléfono',
        };
      }

      // Obtener items de la venta con productos
      const saleItems = await this.dataSource.getRepository(SaleItem).find({
        where: { sale_id: saleId },
        relations: ['product'],
      });

      // Obtener nombre de la tienda
      const store = await this.storeRepository.findOne({
        where: { id: storeId },
      });

      const storeName = store?.name || 'Velox POS';

      // Formatear mensaje
      const message = this.whatsappConfigService.formatSaleMessage(
        { ...sale, items: saleItems, customer: sale.customer ?? undefined },
        config,
        storeName,
      );

      // Agregar a cola
      await this.queueMessage(
        storeId,
        'sale',
        sale.customer.phone,
        message,
        saleId,
        undefined,
        deviceId,
        seq,
      );

      this.logger.log(
        `Notificación de venta ${saleId} agregada a cola para tienda ${storeId}`,
      );
      return { queued: true };
    } catch (error: any) {
      this.logger.error(`Error agregando notificación de venta a cola:`, error);
      return { queued: false, error: error.message || 'Error desconocido' };
    }
  }

  /**
   * Envía notificación de deuda creada
   */
  async sendDebtNotification(
    storeId: string,
    debtId: string,
  ): Promise<{ queued: boolean; error?: string }> {
    try {
      // Verificar configuración
      const config = await this.whatsappConfigService.findOne(storeId);
      if (!config || !config.debt_notifications_enabled) {
        return {
          queued: false,
          error: 'Notificaciones de deudas no están habilitadas',
        };
      }

      // Obtener deuda con relaciones
      const debt = await this.debtRepository.findOne({
        where: { id: debtId, store_id: storeId },
        relations: ['customer', 'sale'],
      });

      if (!debt) {
        return { queued: false, error: 'Deuda no encontrada' };
      }

      // Verificar si tiene cliente con teléfono
      if (!debt.customer?.phone) {
        return {
          queued: false,
          error: 'El cliente no tiene teléfono registrado',
        };
      }

      // Si hay venta asociada, cargar los items con productos y variantes
      let saleWithItems: Sale | undefined = undefined;
      if (debt.sale_id) {
        const saleItems = await this.dataSource.getRepository(SaleItem).find({
          where: { sale_id: debt.sale_id },
          relations: ['product', 'variant'],
        });

        saleWithItems = debt.sale
          ? ({
              ...debt.sale,
              items: saleItems,
            } as Sale & { items: SaleItem[] })
          : undefined;
      }

      // Obtener nombre de la tienda
      const store = await this.storeRepository.findOne({
        where: { id: storeId },
      });

      const storeName = store?.name || 'Velox POS';

      // Formatear mensaje
      const debtForMessage = {
        ...debt,
        customer: debt.customer ?? undefined,
        sale: saleWithItems,
      } as Debt & { customer?: Customer; sale?: Sale & { items?: SaleItem[] } };
      const message = this.whatsappConfigService.formatDebtMessage(
        debtForMessage,
        config,
        storeName,
      );

      // Agregar a cola
      await this.queueMessage(
        storeId,
        'debt',
        debt.customer.phone,
        message,
        debtId,
      );

      this.logger.log(
        `Notificación de deuda ${debtId} agregada a cola para tienda ${storeId}`,
      );
      return { queued: true };
    } catch (error: any) {
      this.logger.error(`Error agregando notificación de deuda a cola:`, error);
      return { queued: false, error: error.message || 'Error desconocido' };
    }
  }

  /**
   * Envía recordatorio de deudas pendientes.
   * Si debtIds está definido y no vacío, solo se incluyen esas deudas; si no, todas las pendientes.
   */
  async sendDebtReminder(
    storeId: string,
    customerId: string,
    debtIds?: string[],
  ): Promise<{ queued: boolean; error?: string }> {
    try {
      // Verificar configuración
      const config = await this.whatsappConfigService.findOne(storeId);
      if (!config || !config.debt_reminders_enabled) {
        return {
          queued: false,
          error: 'Recordatorios de deudas no están habilitados',
        };
      }

      // Obtener cliente
      const customer = await this.customerRepository.findOne({
        where: { id: customerId, store_id: storeId },
      });

      if (!customer || !customer.phone) {
        return { queued: false, error: 'Cliente no encontrado o sin teléfono' };
      }

      // Condición base: deudas pendientes del cliente
      const where: Record<string, unknown> = {
        customer_id: customerId,
        store_id: storeId,
        status: In(['open', 'partial']),
      };
      if (debtIds && debtIds.length > 0) {
        where.id = In(debtIds);
      }

      // Obtener deudas pendientes
      const debts = await this.debtRepository.find({
        where,
        relations: ['payments', 'sale'],
        order: { created_at: 'ASC' },
      });

      // Si se pidieron debtIds, asegurar que todas existen y pertenecen al cliente
      if (debtIds && debtIds.length > 0) {
        const foundIds = new Set(debts.map((d) => d.id));
        const missing = debtIds.filter((id) => !foundIds.has(id));
        if (missing.length > 0) {
          return {
            queued: false,
            error:
              'Algunas deudas seleccionadas no existen o no están pendientes',
          };
        }
      }

      if (debts.length === 0) {
        return { queued: false, error: 'No hay deudas pendientes' };
      }

      // Cargar items de las ventas asociadas a cada deuda
      const debtsWithItems = await Promise.all(
        debts.map(async (debt) => {
          let saleWithItems: (Sale & { items?: SaleItem[] }) | undefined =
            undefined;

          if (debt.sale_id) {
            const saleItems = await this.dataSource
              .getRepository(SaleItem)
              .find({
                where: { sale_id: debt.sale_id },
                relations: ['product', 'variant'],
              });

            // Siempre adjuntar items cuando hay sale_id: si debt.sale es null
            // (ej. venta anulada o relación no cargada), crear objeto mínimo con items
            // para que el formateador pueda mostrar debt.sale?.items
            saleWithItems = {
              ...(debt.sale ?? {}),
              id: debt.sale_id,
              items: saleItems,
            } as Sale & { items: SaleItem[] };
          }

          return {
            ...debt,
            sale: saleWithItems,
          } as Debt & { sale?: Sale & { items?: SaleItem[] } };
        }),
      );

      // Obtener nombre de la tienda
      const store = await this.storeRepository.findOne({
        where: { id: storeId },
      });

      const storeName = store?.name || 'Velox POS';

      // Formatear mensaje
      const message = this.whatsappConfigService.formatDebtReminderMessage(
        debtsWithItems,
        customer,
        config,
        storeName,
      );

      // Agregar a cola
      await this.queueMessage(
        storeId,
        'debt_reminder',
        customer.phone,
        message,
        customerId,
      );

      this.logger.log(
        `Recordatorio de deudas agregado a cola para cliente ${customerId} en tienda ${storeId}`,
      );
      return { queued: true };
    } catch (error: any) {
      this.logger.error(
        `Error agregando recordatorio de deudas a cola:`,
        error,
      );
      return { queued: false, error: error.message || 'Error desconocido' };
    }
  }

  /**
   * Envía mensaje personalizado a un cliente
   */
  async sendCustomMessage(
    storeId: string,
    customerId: string,
    customMessage: string,
  ): Promise<{ queued: boolean; error?: string }> {
    try {
      // Verificar configuración
      const config = await this.whatsappConfigService.findOne(storeId);
      if (!config) {
        return {
          queued: false,
          error: 'Configuración de WhatsApp no encontrada',
        };
      }

      // Obtener cliente
      const customer = await this.customerRepository.findOne({
        where: { id: customerId, store_id: storeId },
      });

      if (!customer || !customer.phone) {
        return { queued: false, error: 'Cliente no encontrado o sin teléfono' };
      }

      // Obtener nombre de la tienda
      const store = await this.storeRepository.findOne({
        where: { id: storeId },
      });

      const storeName = store?.name || 'Velox POS';

      // Formatear mensaje
      const message = this.whatsappConfigService.formatCustomerMessage(
        customer,
        customMessage,
        config,
        storeName,
      );

      // Agregar a cola
      await this.queueMessage(
        storeId,
        'custom',
        customer.phone,
        message,
        customerId,
      );

      this.logger.log(
        `Mensaje personalizado agregado a cola para cliente ${customerId} en tienda ${storeId}`,
      );
      return { queued: true };
    } catch (error: any) {
      this.logger.error(`Error agregando mensaje personalizado a cola:`, error);
      return { queued: false, error: error.message || 'Error desconocido' };
    }
  }
}
