import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DiscountConfig,
  AuthorizationRole,
} from '../database/entities/discount-config.entity';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export interface DiscountValidationResult {
  requires_authorization: boolean;
  error?: string;
  auto_approved?: boolean;
}

/**
 * Servicio para validar y gestionar reglas de descuentos
 */
@Injectable()
export class DiscountRulesService {
  constructor(
    @InjectRepository(DiscountConfig)
    private configRepository: Repository<DiscountConfig>,
  ) {}

  /**
   * Determina si un descuento requiere autorización
   */
  async requiresAuthorization(
    storeId: string,
    discountAmountBs: number,
    discountAmountUsd: number,
    discountPercentage: number,
  ): Promise<DiscountValidationResult> {
    const config = await this.getOrCreateConfig(storeId);

    // Si no requiere autorización en general, permitir
    if (!config.requires_authorization) {
      return { requires_authorization: false, auto_approved: true };
    }

    // Verificar auto-aprobación por porcentaje
    if (
      config.auto_approve_below_percentage !== null &&
      discountPercentage <= config.auto_approve_below_percentage
    ) {
      return { requires_authorization: false, auto_approved: true };
    }

    // Verificar auto-aprobación por monto
    if (
      config.auto_approve_below_amount_bs !== null &&
      discountAmountBs <= config.auto_approve_below_amount_bs
    ) {
      return { requires_authorization: false, auto_approved: true };
    }

    // Verificar si excede límites máximos
    if (
      config.max_percentage > 0 &&
      discountPercentage > config.max_percentage
    ) {
      return {
        requires_authorization: true,
        error: `El descuento (${discountPercentage.toFixed(2)}%) excede el máximo permitido (${config.max_percentage.toFixed(2)}%)`,
      };
    }

    if (
      config.max_amount_bs !== null &&
      discountAmountBs > config.max_amount_bs
    ) {
      return {
        requires_authorization: true,
        error: `El descuento en Bs (${discountAmountBs.toFixed(2)}) excede el máximo permitido (${config.max_amount_bs.toFixed(2)})`,
      };
    }

    if (
      config.max_amount_usd !== null &&
      discountAmountUsd > config.max_amount_usd
    ) {
      return {
        requires_authorization: true,
        error: `El descuento en USD (${discountAmountUsd.toFixed(2)}) excede el máximo permitido (${config.max_amount_usd.toFixed(2)})`,
      };
    }

    // Si pasa todas las validaciones pero requiere autorización
    return { requires_authorization: true };
  }

  /**
   * Valida si un usuario puede autorizar descuentos según su rol
   */
  validateAuthorizationRole(userRole: string, config: DiscountConfig): boolean {
    if (!config.authorization_role) {
      return true; // Sin restricción de rol
    }

    const roleHierarchy: Record<AuthorizationRole | string, number> = {
      owner: 4,
      admin: 3,
      supervisor: 2,
      cashier: 1,
    };

    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[config.authorization_role] || 0;

    return userLevel >= requiredLevel;
  }

  /**
   * Valida un PIN de autorización (si aplica)
   */
  async validateAuthorizationPin(
    pin: string,
    pinHash: string | null,
  ): Promise<boolean> {
    if (!pinHash) {
      return true; // No requiere PIN
    }

    if (!pin) {
      return false;
    }

    return bcrypt.compare(pin, pinHash);
  }

  /**
   * Obtiene o crea la configuración de descuentos para una tienda
   */
  async getOrCreateConfig(storeId: string): Promise<DiscountConfig> {
    let config = await this.configRepository.findOne({
      where: { store_id: storeId },
    });

    if (!config) {
      // Crear configuración por defecto
      config = this.configRepository.create({
        id: randomUUID(),
        store_id: storeId,
        max_percentage: 0, // Sin límite por defecto
        max_amount_bs: null,
        max_amount_usd: null,
        requires_authorization: true,
        authorization_role: 'supervisor',
        auto_approve_below_percentage: 5, // Auto-aprobar descuentos menores a 5%
        auto_approve_below_amount_bs: null,
      });

      config = await this.configRepository.save(config);
    }

    return config;
  }

  /**
   * Obtiene la configuración de descuentos
   */
  async getConfig(storeId: string): Promise<DiscountConfig | null> {
    return this.configRepository.findOne({
      where: { store_id: storeId },
    });
  }
}
