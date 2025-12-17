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
      existing.min_amount_bs = dto.min_amount_bs ?? null;
      existing.min_amount_usd = dto.min_amount_usd ?? null;
      existing.max_amount_bs = dto.max_amount_bs ?? null;
      existing.max_amount_usd = dto.max_amount_usd ?? null;
      existing.enabled = dto.enabled ?? existing.enabled;
      existing.requires_authorization =
        dto.requires_authorization ?? existing.requires_authorization;
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
      order: { method: 'ASC' },
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
