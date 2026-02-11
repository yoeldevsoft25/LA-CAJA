import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentMethodConfig,
  PaymentMethod,
} from '../database/entities/payment-method-config.entity';
import { CreatePaymentMethodConfigDto } from './dto/create-payment-method-config.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de configuraciones de métodos de pago
 */
@Injectable()
export class PaymentMethodConfigsService {
  constructor(
    @InjectRepository(PaymentMethodConfig)
    private configRepository: Repository<PaymentMethodConfig>,
  ) {}

  private getDefaultSortOrder(method: PaymentMethod): number {
    const orderMap: Record<PaymentMethod, number> = {
      CASH_USD: 10,
      CASH_BS: 20,
      PAGO_MOVIL: 30,
      TRANSFER: 40,
      POINT_OF_SALE: 50,
      ZELLE: 60,
      OTHER: 50,
      SPLIT: 90,
      FIAO: 90,
    };

    return orderMap[method] ?? 0;
  }

  /**
   * Crea o actualiza una configuración de método de pago
   */
  async upsertConfig(
    storeId: string,
    dto: CreatePaymentMethodConfigDto,
  ): Promise<PaymentMethodConfig> {
    // Buscar configuración existente
    const existing = await this.configRepository.findOne({
      where: { store_id: storeId, method: dto.method as PaymentMethod },
    });

    if (existing) {
      // Actualizar
      if (dto.min_amount_bs !== undefined) {
        existing.min_amount_bs = dto.min_amount_bs;
      }
      if (dto.min_amount_usd !== undefined) {
        existing.min_amount_usd = dto.min_amount_usd;
      }
      if (dto.max_amount_bs !== undefined) {
        existing.max_amount_bs = dto.max_amount_bs;
      }
      if (dto.max_amount_usd !== undefined) {
        existing.max_amount_usd = dto.max_amount_usd;
      }
      if (dto.enabled !== undefined) {
        existing.enabled = dto.enabled;
      }
      if (dto.requires_authorization !== undefined) {
        existing.requires_authorization = dto.requires_authorization;
      }
      if (dto.sort_order !== undefined && dto.sort_order !== null) {
        existing.sort_order = dto.sort_order;
      }
      if (dto.commission_percentage !== undefined) {
        existing.commission_percentage = dto.commission_percentage ?? 0;
      }
      existing.updated_at = new Date();

      return this.configRepository.save(existing);
    } else {
      // Crear nueva
      const config = this.configRepository.create({
        id: randomUUID(),
        store_id: storeId,
        method: dto.method,
        min_amount_bs: dto.min_amount_bs ?? null,
        min_amount_usd: dto.min_amount_usd ?? null,
        max_amount_bs: dto.max_amount_bs ?? null,
        max_amount_usd: dto.max_amount_usd ?? null,
        enabled: dto.enabled ?? true,
        requires_authorization: dto.requires_authorization ?? false,
        sort_order:
          dto.sort_order ??
          this.getDefaultSortOrder(dto.method as PaymentMethod),
        commission_percentage: dto.commission_percentage ?? 0,
      });

      return this.configRepository.save(config);
    }
  }

  /**
   * Obtiene todas las configuraciones de métodos de pago de una tienda
   */
  async getConfigs(storeId: string): Promise<PaymentMethodConfig[]> {
    return this.configRepository.find({
      where: { store_id: storeId },
      order: { sort_order: 'ASC', method: 'ASC' },
    });
  }

  /**
   * Obtiene la configuración de un método específico
   */
  async getConfig(
    storeId: string,
    method: string,
  ): Promise<PaymentMethodConfig | null> {
    return this.configRepository.findOne({
      where: { store_id: storeId, method: method as PaymentMethod },
    });
  }

  /**
   * Elimina una configuración
   */
  async deleteConfig(storeId: string, method: string): Promise<void> {
    const config = await this.configRepository.findOne({
      where: { store_id: storeId, method: method as PaymentMethod },
    });

    if (!config) {
      throw new NotFoundException(
        `Configuración para método ${method} no encontrada`,
      );
    }

    await this.configRepository.remove(config);
  }
}
