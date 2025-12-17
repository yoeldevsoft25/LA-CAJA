import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentMethodConfig,
  PaymentMethod,
} from '../database/entities/payment-method-config.entity';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface PaymentSplit {
  cash_bs?: number;
  cash_usd?: number;
  pago_movil_bs?: number;
  transfer_bs?: number;
  other_bs?: number;
}

/**
 * Servicio para validar métodos de pago según configuración de topes
 */
@Injectable()
export class PaymentRulesService {
  constructor(
    @InjectRepository(PaymentMethodConfig)
    private configRepository: Repository<PaymentMethodConfig>,
  ) {}

  /**
   * Valida un método de pago individual según la configuración
   */
  async validatePaymentMethod(
    storeId: string,
    method: string,
    amount: number,
    currency: 'BS' | 'USD',
  ): Promise<ValidationResult> {
    const config = await this.configRepository.findOne({
      where: { store_id: storeId, method: method as PaymentMethod },
    });

    // Si no hay configuración, permitir (comportamiento por defecto)
    if (!config) {
      return { valid: true };
    }

    // Si el método está deshabilitado
    if (!config.enabled) {
      return {
        valid: false,
        error: `El método de pago ${method} está deshabilitado`,
      };
    }

    // Validar monto mínimo
    const minAmount =
      currency === 'BS' ? config.min_amount_bs : config.min_amount_usd;
    if (minAmount !== null && amount < minAmount) {
      return {
        valid: false,
        error: `Monto mínimo para ${method}: ${minAmount.toFixed(2)} ${currency}`,
      };
    }

    // Validar monto máximo
    const maxAmount =
      currency === 'BS' ? config.max_amount_bs : config.max_amount_usd;
    if (maxAmount !== null && amount > maxAmount) {
      return {
        valid: false,
        error: `Monto máximo para ${method}: ${maxAmount.toFixed(2)} ${currency}`,
      };
    }

    return { valid: true };
  }

  /**
   * Valida un pago split (múltiples métodos)
   */
  async validateSplitPayment(
    storeId: string,
    split: PaymentSplit,
  ): Promise<ValidationResult> {
    // Mapeo de campos del split a métodos de pago
    const methodMap: Record<
      string,
      { method: string; currency: 'BS' | 'USD' }
    > = {
      cash_bs: { method: 'CASH_BS', currency: 'BS' },
      cash_usd: { method: 'CASH_USD', currency: 'USD' },
      pago_movil_bs: { method: 'PAGO_MOVIL', currency: 'BS' },
      transfer_bs: { method: 'TRANSFER', currency: 'BS' },
      other_bs: { method: 'OTHER', currency: 'BS' },
    };

    for (const [field, amount] of Object.entries(split)) {
      if (amount && amount > 0) {
        const mapping = methodMap[field];
        if (!mapping) {
          continue; // Ignorar campos desconocidos
        }

        const result = await this.validatePaymentMethod(
          storeId,
          mapping.method,
          amount,
          mapping.currency,
        );

        if (!result.valid) {
          return result;
        }
      }
    }

    return { valid: true };
  }

  /**
   * Valida si un método requiere autorización
   */
  async requiresAuthorization(
    storeId: string,
    method: string,
  ): Promise<boolean> {
    const config = await this.configRepository.findOne({
      where: { store_id: storeId, method: method as PaymentMethod },
    });

    return config?.requires_authorization || false;
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
}
