import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { ExchangeRate } from '../database/entities/exchange-rate.entity';
import { randomUUID } from 'crypto';

interface BCVRateResponse {
  rate: number;
  source: 'api' | 'manual';
  timestamp: Date;
  date?: string;
}

interface DolarAPIOfficialResponse {
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

@Injectable()
export class ExchangeService {
  private readonly logger = new Logger(ExchangeService.name);
  private cachedRate: BCVRateResponse | null = null;
  private readonly CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hora de cache
  private readonly axiosInstance: AxiosInstance;
  private readonly DOLAR_API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
  private fetchPromise: Promise<BCVRateResponse | null> | null = null; // Prevenir múltiples requests simultáneos

  constructor(
    private configService: ConfigService,
    @InjectRepository(ExchangeRate)
    private exchangeRateRepository: Repository<ExchangeRate>,
  ) {
    this.axiosInstance = axios.create({
      timeout: 5000, // 5 segundos timeout
      headers: {
        Accept: 'application/json',
      },
    });
  }

  /**
   * Obtiene la tasa BCV actual con fallback:
   * 1. Busca tasa manual activa en BD
   * 2. Si no hay, intenta obtener de API
   * 3. Si falla API, usa última tasa manual o fallback por defecto
   */
  async getBCVRate(storeId?: string): Promise<BCVRateResponse | null> {
    // Si hay un cache válido, retornarlo
    if (this.cachedRate && this.isCacheValid()) {
      this.logger.debug('Usando tasa BCV del cache');
      return this.cachedRate;
    }

    // Si hay storeId, buscar tasa manual activa en BD
    if (storeId) {
      const manualRate = await this.getActiveManualRate(storeId);
      if (manualRate) {
        this.cachedRate = {
          rate: Number(manualRate.rate),
          source: 'manual',
          timestamp: manualRate.effective_from,
        };
        this.logger.log(`Usando tasa manual de BD: ${manualRate.rate}`);
        return this.cachedRate;
      }
    }

    // Si ya hay un request en progreso, esperar a que termine
    if (this.fetchPromise) {
      this.logger.debug('Esperando request de tasa BCV en progreso...');
      return this.fetchPromise;
    }

    // Crear nuevo request
    this.fetchPromise = this.fetchRate(storeId);

    try {
      const result = await this.fetchPromise;
      return result;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Obtiene la tasa actual con fallback garantizado
   * Retorna siempre una tasa (usa fallback por defecto si es necesario)
   */
  async getCurrentRate(
    storeId?: string,
    fallbackRate: number = 36,
  ): Promise<number> {
    const rateData = await this.getBCVRate(storeId);
    if (rateData && rateData.rate > 0) {
      return rateData.rate;
    }
    this.logger.warn(`Usando tasa fallback: ${fallbackRate}`);
    return fallbackRate;
  }

  /**
   * Obtiene la tasa desde la API y actualiza el cache
   */
  private async fetchRate(storeId?: string): Promise<BCVRateResponse | null> {
    try {
      const rate = await this.fetchFromBCVAPI();
      if (rate) {
        this.cachedRate = {
          rate,
          source: 'api',
          timestamp: new Date(),
        };
        this.logger.log(`Tasa BCV obtenida y cacheada: ${rate}`);

        // Si hay storeId, guardar en BD como referencia
        if (storeId) {
          await this.saveApiRate(storeId, rate).catch((err) => {
            this.logger.warn('Error al guardar tasa API en BD', err);
          });
        }

        return this.cachedRate;
      }
    } catch (error) {
      this.logger.warn(
        'Error al obtener tasa del BCV',
        error instanceof Error ? error.message : String(error),
      );
    }

    // Si hay storeId, buscar última tasa manual como fallback
    if (storeId) {
      const lastManualRate = await this.getLastManualRate(storeId);
      if (lastManualRate) {
        this.cachedRate = {
          rate: Number(lastManualRate.rate),
          source: 'manual',
          timestamp: lastManualRate.effective_from,
        };
        this.logger.log(
          `Usando última tasa manual como fallback: ${lastManualRate.rate}`,
        );
        return this.cachedRate;
      }
    }

    // Si hay un cache expirado pero válido, usarlo como fallback
    if (this.cachedRate) {
      this.logger.warn('Usando tasa BCV cacheada (expirada) como fallback');
      return this.cachedRate;
    }

    // Si no se pudo obtener, retornar null
    return null;
  }

  /**
   * Obtiene la tasa del BCV desde la API de DolarAPI.com
   * Fuente: https://dolarapi.com/docs/venezuela/operations/get-dolar-oficial.html
   */
  private async fetchFromBCVAPI(): Promise<number | null> {
    try {
      this.logger.log('Obteniendo tasa BCV desde DolarAPI...');

      const response = await this.axiosInstance.get<DolarAPIOfficialResponse>(
        this.DOLAR_API_URL,
      );

      const data = response.data;

      // Validar que tenemos un promedio válido
      if (!data.promedio || data.promedio <= 0) {
        this.logger.warn('La API devolvió un promedio inválido');
        return null;
      }

      this.logger.log(
        `Tasa BCV obtenida: ${data.promedio} (actualizada: ${data.fechaActualizacion})`,
      );

      return data.promedio;
    } catch (error: any) {
      if (error.response) {
        this.logger.error(
          `Error HTTP al obtener tasa BCV: ${error.response.status} - ${error.response.statusText}`,
        );
      } else if (error.request) {
        this.logger.error(
          'Error de conexión al obtener tasa BCV (sin respuesta)',
        );
      } else {
        this.logger.error(`Error al obtener tasa BCV: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Valida si el cache es válido (no expirado)
   */
  private isCacheValid(): boolean {
    if (!this.cachedRate) return false;
    const now = new Date();
    const cacheAge = now.getTime() - this.cachedRate.timestamp.getTime();
    return cacheAge < this.CACHE_DURATION_MS;
  }

  /**
   * Establece una tasa manual en la BD
   */
  async setManualRate(
    storeId: string,
    rate: number,
    userId?: string,
    effectiveFrom?: Date,
    effectiveUntil?: Date,
    note?: string,
  ): Promise<ExchangeRate> {
    if (rate <= 0) {
      throw new BadRequestException('La tasa debe ser mayor a cero');
    }

    const now = new Date();

    // Desactivar tasas manuales anteriores que se solapen
    if (effectiveFrom || effectiveUntil) {
      await this.exchangeRateRepository.update(
        {
          store_id: storeId,
          source: 'manual',
          is_active: true,
        },
        {
          is_active: false,
        },
      );
    }

    const exchangeRate = this.exchangeRateRepository.create({
      id: randomUUID(),
      store_id: storeId,
      rate,
      source: 'manual',
      effective_from: effectiveFrom || now,
      effective_until: effectiveUntil || null,
      is_active: true,
      note: note || null,
      created_by: userId || null,
    });

    const saved = await this.exchangeRateRepository.save(exchangeRate);

    // Actualizar cache
    this.cachedRate = {
      rate,
      source: 'manual',
      timestamp: saved.effective_from,
    };

    this.logger.log(
      `Tasa manual establecida en BD: ${rate} para store ${storeId}`,
    );
    return saved;
  }

  /**
   * Obtiene la tasa manual activa para un store
   */
  async getActiveManualRate(storeId: string): Promise<ExchangeRate | null> {
    const now = new Date();

    return this.exchangeRateRepository
      .createQueryBuilder('rate')
      .where('rate.store_id = :storeId', { storeId })
      .andWhere('rate.source = :source', { source: 'manual' })
      .andWhere('rate.is_active = :isActive', { isActive: true })
      .andWhere('rate.effective_from <= :now', { now })
      .andWhere(
        '(rate.effective_until IS NULL OR rate.effective_until >= :now)',
        { now },
      )
      .orderBy('rate.effective_from', 'DESC')
      .getOne();
  }

  /**
   * Obtiene la última tasa manual (aunque esté inactiva)
   */
  async getLastManualRate(storeId: string): Promise<ExchangeRate | null> {
    return this.exchangeRateRepository.findOne({
      where: {
        store_id: storeId,
        source: 'manual',
      },
      order: {
        effective_from: 'DESC',
      },
    });
  }

  /**
   * Guarda una tasa obtenida de la API en BD (solo referencia)
   */
  private async saveApiRate(
    storeId: string,
    rate: number,
  ): Promise<ExchangeRate> {
    const now = new Date();

    // Buscar si ya existe una tasa API para hoy
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await this.exchangeRateRepository
      .createQueryBuilder('rate')
      .where('rate.store_id = :storeId', { storeId })
      .andWhere('rate.source = :source', { source: 'api' })
      .andWhere('rate.effective_from >= :today', { today })
      .andWhere('rate.effective_from < :tomorrow', { tomorrow })
      .getOne();

    if (existing) {
      existing.rate = rate;
      existing.updated_at = now;
      return this.exchangeRateRepository.save(existing);
    }

    const exchangeRate = this.exchangeRateRepository.create({
      id: randomUUID(),
      store_id: storeId,
      rate,
      source: 'api',
      effective_from: now,
      effective_until: null,
      is_active: true,
    });

    return this.exchangeRateRepository.save(exchangeRate);
  }

  /**
   * Obtiene el historial de tasas para un store
   */
  async getRateHistory(
    storeId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ rates: ExchangeRate[]; total: number }> {
    const query = this.exchangeRateRepository
      .createQueryBuilder('rate')
      .where('rate.store_id = :storeId', { storeId })
      .orderBy('rate.effective_from', 'DESC');

    const total = await query.getCount();
    query.limit(limit).offset(offset);

    const rates = await query.getMany();

    return { rates, total };
  }

  /**
   * Obtiene la tasa cacheada (si existe)
   */
  getCachedRate(): BCVRateResponse | null {
    if (this.isCacheValid()) {
      return this.cachedRate;
    }
    return null;
  }
}
