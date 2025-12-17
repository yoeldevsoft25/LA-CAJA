import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscountConfig } from '../database/entities/discount-config.entity';
import { CreateDiscountConfigDto } from './dto/create-discount-config.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de configuración de descuentos
 */
@Injectable()
export class DiscountConfigsService {
  constructor(
    @InjectRepository(DiscountConfig)
    private configRepository: Repository<DiscountConfig>,
  ) {}

  /**
   * Crea o actualiza la configuración de descuentos
   */
  async upsertConfig(
    storeId: string,
    dto: CreateDiscountConfigDto,
  ): Promise<DiscountConfig> {
    const existing = await this.configRepository.findOne({
      where: { store_id: storeId },
    });

    if (existing) {
      // Actualizar
      if (dto.max_percentage !== undefined) {
        existing.max_percentage = dto.max_percentage;
      }
      if (dto.max_amount_bs !== undefined) {
        existing.max_amount_bs = dto.max_amount_bs;
      }
      if (dto.max_amount_usd !== undefined) {
        existing.max_amount_usd = dto.max_amount_usd;
      }
      if (dto.requires_authorization !== undefined) {
        existing.requires_authorization = dto.requires_authorization;
      }
      if (dto.authorization_role !== undefined) {
        existing.authorization_role = dto.authorization_role;
      }
      if (dto.auto_approve_below_percentage !== undefined) {
        existing.auto_approve_below_percentage =
          dto.auto_approve_below_percentage;
      }
      if (dto.auto_approve_below_amount_bs !== undefined) {
        existing.auto_approve_below_amount_bs =
          dto.auto_approve_below_amount_bs;
      }
      existing.updated_at = new Date();

      return this.configRepository.save(existing);
    } else {
      // Crear nueva
      const config = this.configRepository.create({
        id: randomUUID(),
        store_id: storeId,
        max_percentage: dto.max_percentage ?? 0,
        max_amount_bs: dto.max_amount_bs ?? null,
        max_amount_usd: dto.max_amount_usd ?? null,
        requires_authorization: dto.requires_authorization ?? true,
        authorization_role: dto.authorization_role ?? 'supervisor',
        auto_approve_below_percentage: dto.auto_approve_below_percentage ?? 5,
        auto_approve_below_amount_bs: dto.auto_approve_below_amount_bs ?? null,
      });

      return this.configRepository.save(config);
    }
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
