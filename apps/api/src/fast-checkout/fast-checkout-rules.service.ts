import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FastCheckoutConfig } from '../database/entities/fast-checkout-config.entity';
import { randomUUID } from 'crypto';

export interface FastCheckoutValidationResult {
  valid: boolean;
  error?: string;
  config?: FastCheckoutConfig;
}

/**
 * Servicio para validar reglas de modo caja rápida
 */
@Injectable()
export class FastCheckoutRulesService {
  constructor(
    @InjectRepository(FastCheckoutConfig)
    private configRepository: Repository<FastCheckoutConfig>,
  ) {}

  /**
   * Valida si una venta cumple con las reglas de caja rápida
   */
  async validateFastCheckout(
    storeId: string,
    itemCount: number,
    hasDiscounts: boolean,
    hasCustomer: boolean,
  ): Promise<FastCheckoutValidationResult> {
    const config = await this.getOrCreateConfig(storeId);

    // Si el modo no está habilitado, no validar
    if (!config.enabled) {
      return { valid: true, config };
    }

    // Validar límite de items
    if (itemCount > config.max_items) {
      return {
        valid: false,
        error: `El modo caja rápida permite máximo ${config.max_items} items. Tienes ${itemCount} items.`,
        config,
      };
    }

    // Validar descuentos
    if (hasDiscounts && !config.allow_discounts) {
      return {
        valid: false,
        error: 'El modo caja rápida no permite descuentos',
        config,
      };
    }

    // Validar selección de cliente
    if (hasCustomer && !config.allow_customer_selection) {
      return {
        valid: false,
        error: 'El modo caja rápida no permite seleccionar cliente',
        config,
      };
    }

    return { valid: true, config };
  }

  /**
   * Obtiene o crea la configuración de caja rápida
   */
  async getOrCreateConfig(storeId: string): Promise<FastCheckoutConfig> {
    let config = await this.configRepository.findOne({
      where: { store_id: storeId },
    });

    if (!config) {
      // Crear configuración por defecto
      config = this.configRepository.create({
        id: randomUUID(),
        store_id: storeId,
        max_items: 10,
        enabled: true,
        allow_discounts: false,
        allow_customer_selection: false,
        default_payment_method: 'CASH_BS',
      });

      config = await this.configRepository.save(config);
    }

    return config;
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
