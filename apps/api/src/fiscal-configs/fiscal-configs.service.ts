import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FiscalConfig } from '../database/entities/fiscal-config.entity';
import { CreateFiscalConfigDto } from './dto/create-fiscal-config.dto';
import { UpdateFiscalConfigDto } from './dto/update-fiscal-config.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de configuración fiscal
 */
@Injectable()
export class FiscalConfigsService {
  private readonly logger = new Logger(FiscalConfigsService.name);

  constructor(
    @InjectRepository(FiscalConfig)
    private fiscalConfigRepository: Repository<FiscalConfig>,
  ) {}

  /**
   * Crea o actualiza la configuración fiscal de una tienda
   * Solo puede haber una configuración por tienda
   */
  async upsert(
    storeId: string,
    dto: CreateFiscalConfigDto,
  ): Promise<FiscalConfig> {
    const existing = await this.fiscalConfigRepository.findOne({
      where: { store_id: storeId },
    });

    if (existing) {
      // Actualizar existente
      Object.assign(existing, {
        tax_id: dto.tax_id,
        business_name: dto.business_name,
        business_address: dto.business_address,
        business_phone: dto.business_phone || null,
        business_email: dto.business_email || null,
        default_tax_rate: dto.default_tax_rate ?? 16.0,
        fiscal_authorization_number: dto.fiscal_authorization_number || null,
        fiscal_authorization_date: dto.fiscal_authorization_date
          ? new Date(dto.fiscal_authorization_date)
          : null,
        fiscal_authorization_expiry: dto.fiscal_authorization_expiry
          ? new Date(dto.fiscal_authorization_expiry)
          : null,
        fiscal_control_system: dto.fiscal_control_system || null,
        note: dto.note || null,
      });

      return this.fiscalConfigRepository.save(existing);
    } else {
      // Crear nuevo
      const config = this.fiscalConfigRepository.create({
        id: randomUUID(),
        store_id: storeId,
        tax_id: dto.tax_id,
        business_name: dto.business_name,
        business_address: dto.business_address,
        business_phone: dto.business_phone || null,
        business_email: dto.business_email || null,
        default_tax_rate: dto.default_tax_rate ?? 16.0,
        fiscal_authorization_number: dto.fiscal_authorization_number || null,
        fiscal_authorization_date: dto.fiscal_authorization_date
          ? new Date(dto.fiscal_authorization_date)
          : null,
        fiscal_authorization_expiry: dto.fiscal_authorization_expiry
          ? new Date(dto.fiscal_authorization_expiry)
          : null,
        fiscal_control_system: dto.fiscal_control_system || null,
        is_active: true,
        note: dto.note || null,
      });

      return this.fiscalConfigRepository.save(config);
    }
  }

  /**
   * Obtiene la configuración fiscal de una tienda
   */
  async findOne(storeId: string): Promise<FiscalConfig | null> {
    return this.fiscalConfigRepository.findOne({
      where: { store_id: storeId },
    });
  }

  /**
   * Actualiza la configuración fiscal
   */
  async update(
    storeId: string,
    dto: UpdateFiscalConfigDto,
  ): Promise<FiscalConfig> {
    const config = await this.findOne(storeId);

    if (!config) {
      throw new NotFoundException(
        'Configuración fiscal no encontrada. Cree una configuración primero.',
      );
    }

    if (dto.tax_id !== undefined) config.tax_id = dto.tax_id;
    if (dto.business_name !== undefined)
      config.business_name = dto.business_name;
    if (dto.business_address !== undefined)
      config.business_address = dto.business_address;
    if (dto.business_phone !== undefined)
      config.business_phone = dto.business_phone || null;
    if (dto.business_email !== undefined)
      config.business_email = dto.business_email || null;
    if (dto.default_tax_rate !== undefined)
      config.default_tax_rate = dto.default_tax_rate;
    if (dto.fiscal_authorization_number !== undefined)
      config.fiscal_authorization_number =
        dto.fiscal_authorization_number || null;
    if (dto.fiscal_authorization_date !== undefined)
      config.fiscal_authorization_date = dto.fiscal_authorization_date
        ? new Date(dto.fiscal_authorization_date)
        : null;
    if (dto.fiscal_authorization_expiry !== undefined)
      config.fiscal_authorization_expiry = dto.fiscal_authorization_expiry
        ? new Date(dto.fiscal_authorization_expiry)
        : null;
    if (dto.fiscal_control_system !== undefined)
      config.fiscal_control_system = dto.fiscal_control_system || null;
    if (dto.is_active !== undefined) config.is_active = dto.is_active;
    if (dto.note !== undefined) config.note = dto.note || null;

    return this.fiscalConfigRepository.save(config);
  }
}
