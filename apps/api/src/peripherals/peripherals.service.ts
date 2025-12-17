import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PeripheralConfig,
  PeripheralType,
} from '../database/entities/peripheral-config.entity';
import { CreatePeripheralConfigDto } from './dto/create-peripheral-config.dto';
import { UpdatePeripheralConfigDto } from './dto/update-peripheral-config.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de periféricos
 */
@Injectable()
export class PeripheralsService {
  constructor(
    @InjectRepository(PeripheralConfig)
    private peripheralRepository: Repository<PeripheralConfig>,
  ) {}

  /**
   * Crea una nueva configuración de periférico
   */
  async createConfig(
    storeId: string,
    dto: CreatePeripheralConfigDto,
  ): Promise<PeripheralConfig> {
    // Si se marca como default, desmarcar otros del mismo tipo
    if (dto.is_default) {
      await this.peripheralRepository.update(
        {
          store_id: storeId,
          peripheral_type: dto.peripheral_type,
          is_default: true,
        },
        { is_default: false },
      );
    }

    const config = this.peripheralRepository.create({
      id: randomUUID(),
      store_id: storeId,
      peripheral_type: dto.peripheral_type,
      name: dto.name,
      connection_type: dto.connection_type,
      connection_config: dto.connection_config,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
      is_default: dto.is_default || false,
      note: dto.note || null,
    });

    return this.peripheralRepository.save(config);
  }

  /**
   * Obtiene todas las configuraciones de periféricos de una tienda
   */
  async getConfigsByStore(storeId: string): Promise<PeripheralConfig[]> {
    return this.peripheralRepository.find({
      where: { store_id: storeId },
      order: {
        peripheral_type: 'ASC',
        is_default: 'DESC',
        name: 'ASC',
      },
    });
  }

  /**
   * Obtiene configuraciones por tipo
   */
  async getConfigsByType(
    storeId: string,
    type: PeripheralType,
  ): Promise<PeripheralConfig[]> {
    return this.peripheralRepository.find({
      where: { store_id: storeId, peripheral_type: type, is_active: true },
      order: {
        is_default: 'DESC',
        name: 'ASC',
      },
    });
  }

  /**
   * Obtiene la configuración por defecto de un tipo
   */
  async getDefaultConfig(
    storeId: string,
    type: PeripheralType,
  ): Promise<PeripheralConfig | null> {
    return this.peripheralRepository.findOne({
      where: {
        store_id: storeId,
        peripheral_type: type,
        is_default: true,
        is_active: true,
      },
    });
  }

  /**
   * Obtiene una configuración por ID
   */
  async getConfigById(
    storeId: string,
    configId: string,
  ): Promise<PeripheralConfig> {
    const config = await this.peripheralRepository.findOne({
      where: { id: configId, store_id: storeId },
    });

    if (!config) {
      throw new NotFoundException('Configuración de periférico no encontrada');
    }

    return config;
  }

  /**
   * Actualiza una configuración de periférico
   */
  async updateConfig(
    storeId: string,
    configId: string,
    dto: UpdatePeripheralConfigDto,
  ): Promise<PeripheralConfig> {
    const config = await this.getConfigById(storeId, configId);

    // Si se marca como default, desmarcar otros del mismo tipo
    if (dto.is_default === true && !config.is_default) {
      await this.peripheralRepository.update(
        {
          store_id: storeId,
          peripheral_type: config.peripheral_type,
          is_default: true,
        },
        { is_default: false },
      );
    }

    if (dto.name !== undefined) config.name = dto.name;
    if (dto.connection_type !== undefined)
      config.connection_type = dto.connection_type;
    if (dto.connection_config !== undefined)
      config.connection_config = dto.connection_config;
    if (dto.is_active !== undefined) config.is_active = dto.is_active;
    if (dto.is_default !== undefined) config.is_default = dto.is_default;
    if (dto.note !== undefined) config.note = dto.note;

    config.updated_at = new Date();

    return this.peripheralRepository.save(config);
  }

  /**
   * Elimina una configuración de periférico
   */
  async deleteConfig(storeId: string, configId: string): Promise<void> {
    const config = await this.getConfigById(storeId, configId);
    await this.peripheralRepository.remove(config);
  }

  /**
   * Marca una configuración como por defecto
   */
  async setAsDefault(
    storeId: string,
    configId: string,
  ): Promise<PeripheralConfig> {
    const config = await this.getConfigById(storeId, configId);

    // Desmarcar otros del mismo tipo
    await this.peripheralRepository.update(
      {
        store_id: storeId,
        peripheral_type: config.peripheral_type,
        is_default: true,
      },
      { is_default: false },
    );

    config.is_default = true;
    config.updated_at = new Date();

    return this.peripheralRepository.save(config);
  }
}
