import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FastCheckoutConfig } from '../database/entities/fast-checkout-config.entity';
import { CreateFastCheckoutConfigDto } from './dto/create-fast-checkout-config.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de configuración de caja rápida
 */
@Injectable()
export class FastCheckoutConfigsService {
  constructor(
    @InjectRepository(FastCheckoutConfig)
    private configRepository: Repository<FastCheckoutConfig>,
  ) {}

  /**
   * Crea o actualiza la configuración de caja rápida
   */
  async upsertConfig(
    storeId: string,
    dto: CreateFastCheckoutConfigDto,
  ): Promise<FastCheckoutConfig> {
    const existing = await this.configRepository.findOne({
      where: { store_id: storeId },
    });

    if (existing) {
      // Actualizar
      if (dto.max_items !== undefined) {
        existing.max_items = dto.max_items;
      }
      if (dto.enabled !== undefined) {
        existing.enabled = dto.enabled;
      }
      if (dto.allow_discounts !== undefined) {
        existing.allow_discounts = dto.allow_discounts;
      }
      if (dto.allow_customer_selection !== undefined) {
        existing.allow_customer_selection = dto.allow_customer_selection;
      }
      if (dto.default_payment_method !== undefined) {
        existing.default_payment_method = dto.default_payment_method;
      }
      existing.updated_at = new Date();

      return this.configRepository.save(existing);
    } else {
      // Crear nueva
      const config = this.configRepository.create({
        id: randomUUID(),
        store_id: storeId,
        max_items: dto.max_items ?? 10,
        enabled: dto.enabled ?? true,
        allow_discounts: dto.allow_discounts ?? false,
        allow_customer_selection: dto.allow_customer_selection ?? false,
        default_payment_method: dto.default_payment_method ?? 'CASH_BS',
      });

      return this.configRepository.save(config);
    }
  }

  /**
   * Obtiene la configuración de caja rápida
   */
  async getConfig(storeId: string): Promise<FastCheckoutConfig | null> {
    return this.configRepository.findOne({
      where: { store_id: storeId },
    });
  }
}
