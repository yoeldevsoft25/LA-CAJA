import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  ExchangeRate,
  ExchangeRateType,
  StoreRateConfig,
} from '../database/entities';
import { randomUUID } from 'crypto';

// ============================================
// INTERFACES
// ============================================

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

interface DolarVZLAResponse {
  current: {
    usd: number;
    eur: number;
    date: string;
  };
  previous: {
    usd: number;
    eur: number;
    date: string;
  };
  changePercentage: {
    usd: number;
    eur: number;
  };
}

export interface MultiRateResponse {
  bcv: number | null;
  parallel: number | null;
  cash: number | null;
  zelle: number | null;
  updated_at: Date | null;
}

export interface RateByType {
  rate: number;
  rate_type: ExchangeRateType;
  source: 'api' | 'manual';
  is_preferred: boolean;
  effective_from: Date;
}

// ============================================
// UTILIDADES MATEMÁTICAS
// ============================================

/**
 * Convierte un monto decimal a centavos (entero)
 * Evita errores de punto flotante en operaciones monetarias
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convierte centavos a monto decimal
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Convierte USD a BS usando la tasa proporcionada
 */
export function usdToBs(amountUsd: number, rate: number): number {
  if (!rate || rate <= 0) {
    throw new Error(`Tasa de cambio inválida: ${rate}`);
  }
  return Math.round(amountUsd * rate * 100) / 100;
}

/**
 * Convierte BS a USD usando la tasa proporcionada
 */
export function bsToUsd(amountBs: number, rate: number): number {
  if (!rate || rate <= 0) {
    throw new Error(`Tasa de cambio inválida: ${rate}`);
  }
  return Math.round((amountBs / rate) * 100) / 100;
}

/**
 * Redondeo bancario (IEEE 754)
 * 0.5 se redondea al número par más cercano
 */
export function bankerRound(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  const scaled = value * factor;
  const truncated = Math.trunc(scaled);
  const remainder = scaled - truncated;

  if (Math.abs(remainder - 0.5) < 0.0000001) {
    // Si es exactamente 0.5, redondear al par más cercano
    if (truncated % 2 === 0) {
      return truncated / factor;
    } else {
      return (truncated + 1) / factor;
    }
  }
  return Math.round(value * factor) / factor;
}

/**
 * Calcula el desglose óptimo de billetes para cambio en Bs
 */
export function calculateBsChangeBreakdown(changeBs: number): {
  bills: Array<{ denomination: number; count: number; subtotal: number }>;
  total_bs: number;
  excess_cents: number;
  excess_bs: number;
} {
  const denominations = [500, 200, 100, 50, 20, 10, 5, 1];
  let remaining = toCents(changeBs);
  const bills: Array<{
    denomination: number;
    count: number;
    subtotal: number;
  }> = [];

  for (const denom of denominations) {
    const count = Math.floor(remaining / 100 / denom);
    if (count > 0) {
      bills.push({
        denomination: denom,
        count,
        subtotal: denom * count,
      });
      remaining -= count * denom * 100;
    }
  }

  return {
    bills,
    total_bs: changeBs,
    excess_cents: remaining,
    excess_bs: fromCents(remaining),
  };
}

// ============================================
// SERVICIO
// ============================================

@Injectable()
export class ExchangeService {
  private readonly logger = new Logger(ExchangeService.name);
  private cachedRates: Map<string, BCVRateResponse> = new Map();
  private readonly CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hora
  private readonly axiosInstance: AxiosInstance;
  private readonly DOLAR_API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
  private readonly DOLAR_VZLA_API_URL =
    'https://api.dolarvzla.com/public/exchange-rate';
  private fetchPromise: Promise<BCVRateResponse | null> | null = null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(ExchangeRate)
    private exchangeRateRepository: Repository<ExchangeRate>,
    @InjectRepository(StoreRateConfig)
    private storeRateConfigRepository: Repository<StoreRateConfig>,
  ) {
    this.axiosInstance = axios.create({
      timeout: 5000,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  // ============================================
  // MÉTODOS MULTI-TASA
  // ============================================

  /**
   * Obtiene todas las tasas activas para una tienda
   */
  async getAllActiveRates(storeId: string): Promise<MultiRateResponse> {
    const rates: MultiRateResponse = {
      bcv: null,
      parallel: null,
      cash: null,
      zelle: null,
      updated_at: null,
    };

    try {
      const now = new Date();
      const activeRates = await this.exchangeRateRepository
        .createQueryBuilder('rate')
        .where('rate.store_id = :storeId', { storeId })
        .andWhere('rate.is_active = :isActive', { isActive: true })
        .andWhere('rate.effective_from <= :now', { now })
        .andWhere(
          '(rate.effective_until IS NULL OR rate.effective_until >= :now)',
          { now },
        )
        .orderBy('rate.rate_type', 'ASC')
        .addOrderBy('rate.is_preferred', 'DESC')
        .addOrderBy('rate.effective_from', 'DESC')
        .getMany();

      // Agrupar por tipo, quedarse con la preferida o más reciente
      const ratesByType = new Map<ExchangeRateType, ExchangeRate>();
      for (const rate of activeRates) {
        if (!ratesByType.has(rate.rate_type)) {
          ratesByType.set(rate.rate_type, rate);
        }
      }

      ratesByType.forEach((rate, type) => {
        const key = type.toLowerCase() as keyof MultiRateResponse;
        if (key in rates && key !== 'updated_at') {
          (rates as any)[key] = Number(rate.rate);
        }
        if (!rates.updated_at || rate.effective_from > rates.updated_at) {
          rates.updated_at = rate.effective_from;
        }
      });

      // Si no hay BCV en BD, intentar obtener de API
      if (!rates.bcv) {
        const apiRate = await this.getBCVRate(storeId);
        if (apiRate) {
          rates.bcv = apiRate.rate;
          rates.updated_at = apiRate.timestamp;
        }
      }
    } catch (error) {
      this.logger.error(
        'Error al obtener tasas activas',
        error instanceof Error ? error.message : String(error),
      );
    }

    return rates;
  }

  /**
   * Obtiene una tasa específica por tipo
   */
  async getRateByType(
    storeId: string,
    rateType: ExchangeRateType,
  ): Promise<number | null> {
    try {
      const now = new Date();

      const rate = await this.exchangeRateRepository
        .createQueryBuilder('rate')
        .where('rate.store_id = :storeId', { storeId })
        .andWhere('rate.rate_type = :rateType', { rateType })
        .andWhere('rate.is_active = :isActive', { isActive: true })
        .andWhere('rate.effective_from <= :now', { now })
        .andWhere(
          '(rate.effective_until IS NULL OR rate.effective_until >= :now)',
          { now },
        )
        .orderBy('rate.is_preferred', 'DESC')
        .addOrderBy('rate.effective_from', 'DESC')
        .getOne();

      if (rate) {
        return Number(rate.rate);
      }

      // Fallback a BCV si el tipo solicitado no existe
      if (rateType !== 'BCV') {
        return this.getRateByType(storeId, 'BCV');
      }

      // Intentar API como último recurso
      const apiRate = await this.getBCVRate(storeId);
      return apiRate?.rate || null;
    } catch (error) {
      this.logger.error(
        `Error al obtener tasa ${rateType}`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Obtiene la tasa efectiva para una fecha especifica (para cierres / revaluaciones).
   * No usa API externa: se basa en la BD y hace fallback al ultimo registro <= fecha.
   */
  async getRateByTypeAtDate(
    storeId: string,
    rateType: ExchangeRateType,
    at: Date,
  ): Promise<number | null> {
    try {
      const when = new Date(at);

      const rate = await this.exchangeRateRepository
        .createQueryBuilder('rate')
        .where('rate.store_id = :storeId', { storeId })
        .andWhere('rate.rate_type = :rateType', { rateType })
        .andWhere('rate.is_active = :isActive', { isActive: true })
        .andWhere('rate.effective_from <= :when', { when })
        .andWhere(
          '(rate.effective_until IS NULL OR rate.effective_until >= :when)',
          { when },
        )
        .orderBy('rate.is_preferred', 'DESC')
        .addOrderBy('rate.effective_from', 'DESC')
        .getOne();

      if (rate) {
        return Number(rate.rate);
      }

      // Fallback a BCV si el tipo solicitado no existe
      if (rateType !== 'BCV') {
        return this.getRateByTypeAtDate(storeId, 'BCV', at);
      }

      // Fallback final: ultimo registro <= fecha (ignora effective_until)
      const lastRate = await this.exchangeRateRepository
        .createQueryBuilder('rate')
        .where('rate.store_id = :storeId', { storeId })
        .andWhere('rate.rate_type = :rateType', { rateType })
        .andWhere('rate.is_active = :isActive', { isActive: true })
        .andWhere('rate.effective_from <= :when', { when })
        .orderBy('rate.is_preferred', 'DESC')
        .addOrderBy('rate.effective_from', 'DESC')
        .getOne();

      return lastRate ? Number(lastRate.rate) : null;
    } catch (error) {
      this.logger.error(
        `Error al obtener tasa ${rateType} para fecha ${at.toISOString()}`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Obtiene la tasa apropiada para un método de pago específico
   */
  async getRateForPaymentMethod(
    storeId: string,
    method: string,
  ): Promise<{ rate: number; rateType: ExchangeRateType } | null> {
    try {
      // Obtener configuración de la tienda
      let config = await this.storeRateConfigRepository.findOne({
        where: { store_id: storeId },
      });

      // Si no existe config, crear una por defecto
      if (!config) {
        config = this.storeRateConfigRepository.create({
          store_id: storeId,
        });
        await this.storeRateConfigRepository.save(config);
      }

      // Mapear método de pago a tipo de tasa según configuración
      const rateTypeMap: Record<string, ExchangeRateType> = {
        CASH_USD: config.cash_usd_rate_type as ExchangeRateType,
        CASH_BS: config.cash_bs_rate_type as ExchangeRateType,
        PAGO_MOVIL: config.pago_movil_rate_type as ExchangeRateType,
        TRANSFER: config.transfer_rate_type as ExchangeRateType,
        POINT_OF_SALE: config.point_of_sale_rate_type as ExchangeRateType,
        ZELLE: config.zelle_rate_type as ExchangeRateType,
      };

      const rateType = rateTypeMap[method] || 'BCV';
      const rate = await this.getRateByType(storeId, rateType);

      if (rate) {
        return { rate, rateType };
      }

      return null;
    } catch (error) {
      this.logger.error(
        'Error al obtener tasa para método de pago',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Establece una tasa manual con tipo específico
   */
  async setManualRate(
    storeId: string,
    rate: number,
    userId?: string,
    effectiveFrom?: Date,
    effectiveUntil?: Date,
    note?: string,
    rateType: ExchangeRateType = 'BCV',
    isPreferred: boolean = true,
  ): Promise<ExchangeRate> {
    if (rate <= 0) {
      throw new BadRequestException('La tasa debe ser mayor a cero');
    }

    const now = new Date();

    // Si es preferida, desactivar otras preferidas del mismo tipo
    if (isPreferred) {
      await this.exchangeRateRepository.update(
        {
          store_id: storeId,
          rate_type: rateType,
          is_preferred: true,
        },
        {
          is_preferred: false,
        },
      );
    }

    const exchangeRate = this.exchangeRateRepository.create({
      id: randomUUID(),
      store_id: storeId,
      rate,
      source: 'manual',
      rate_type: rateType,
      is_preferred: isPreferred,
      effective_from: effectiveFrom || now,
      effective_until: effectiveUntil || null,
      is_active: true,
      note: note || null,
      created_by: userId || null,
    });

    const saved = await this.exchangeRateRepository.save(exchangeRate);

    // Actualizar cache
    const cacheKey = `${storeId}-${rateType}`;
    this.cachedRates.set(cacheKey, {
      rate,
      source: 'manual',
      timestamp: saved.effective_from,
    });

    this.logger.log(
      `Tasa ${rateType} manual establecida: ${rate} para store ${storeId}`,
    );
    return saved;
  }

  /**
   * Obtiene la configuración de tasas de la tienda
   */
  async getStoreRateConfig(storeId: string): Promise<StoreRateConfig> {
    let config = await this.storeRateConfigRepository.findOne({
      where: { store_id: storeId },
    });

    if (!config) {
      // Crear configuración por defecto
      config = this.storeRateConfigRepository.create({
        store_id: storeId,
      });
      config = await this.storeRateConfigRepository.save(config);
    }

    return config;
  }

  /**
   * Actualiza la configuración de tasas de la tienda
   */
  async updateStoreRateConfig(
    storeId: string,
    updates: Partial<StoreRateConfig>,
  ): Promise<StoreRateConfig> {
    const config = await this.getStoreRateConfig(storeId);

    // Actualizar solo los campos proporcionados
    Object.assign(config, updates);
    config.store_id = storeId; // Asegurar que no se cambie

    return this.storeRateConfigRepository.save(config);
  }

  // ============================================
  // MÉTODOS ORIGINALES (COMPATIBILIDAD)
  // ============================================

  /**
   * Obtiene la tasa BCV actual con fallback
   */
  async getBCVRate(storeId?: string): Promise<BCVRateResponse | null> {
    try {
      const cacheKey = storeId ? `${storeId}-BCV` : 'global-BCV';

      // Si hay cache válido, retornarlo
      if (this.cachedRates.has(cacheKey) && this.isCacheValid(cacheKey)) {
        this.logger.debug('Usando tasa BCV del cache');
        return this.cachedRates.get(cacheKey)!;
      }

      // Si hay storeId, buscar tasa manual activa en BD
      if (storeId) {
        try {
          const manualRate = await this.getActiveManualRate(storeId);
          if (manualRate) {
            const cached: BCVRateResponse = {
              rate: Number(manualRate.rate),
              source: 'manual',
              timestamp: manualRate.effective_from,
            };
            this.cachedRates.set(cacheKey, cached);
            this.logger.log(`Usando tasa manual de BD: ${manualRate.rate}`);
            return cached;
          }
        } catch (dbError) {
          this.logger.error(
            'Error al consultar tasa manual en BD',
            dbError instanceof Error ? dbError.message : String(dbError),
          );
        }
      }

      // Si ya hay un request en progreso, esperar
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
    } catch (error) {
      this.logger.error(
        'Error general en getBCVRate',
        error instanceof Error ? error.message : String(error),
      );
      // Si hay cache expirado, usarlo como último recurso
      const cacheKey = storeId ? `${storeId}-BCV` : 'global-BCV';
      if (this.cachedRates.has(cacheKey)) {
        this.logger.warn('Usando cache expirado como último recurso');
        return this.cachedRates.get(cacheKey)!;
      }
      return null;
    }
  }

  /**
   * Obtiene la tasa actual con fallback garantizado
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

  private async fetchRate(storeId?: string): Promise<BCVRateResponse | null> {
    try {
      const rate = await this.fetchFromBCVAPI();
      if (rate) {
        const cached: BCVRateResponse = {
          rate,
          source: 'api',
          timestamp: new Date(),
        };
        const cacheKey = storeId ? `${storeId}-BCV` : 'global-BCV';
        this.cachedRates.set(cacheKey, cached);
        this.logger.log(`Tasa BCV obtenida y cacheada: ${rate}`);

        // Si hay storeId, guardar en BD
        if (storeId) {
          await this.saveApiRate(storeId, rate).catch((err) => {
            this.logger.warn('Error al guardar tasa API en BD', err);
          });
        }

        return cached;
      }
    } catch (error) {
      this.logger.warn(
        'Error al obtener tasa del BCV',
        error instanceof Error ? error.message : String(error),
      );
    }

    // Fallback a última tasa manual
    if (storeId) {
      const lastManualRate = await this.getLastManualRate(storeId);
      if (lastManualRate) {
        const cached: BCVRateResponse = {
          rate: Number(lastManualRate.rate),
          source: 'manual',
          timestamp: lastManualRate.effective_from,
        };
        const cacheKey = `${storeId}-BCV`;
        this.cachedRates.set(cacheKey, cached);
        this.logger.log(
          `Usando última tasa manual como fallback: ${lastManualRate.rate}`,
        );
        return cached;
      }
    }

    return null;
  }

  private async fetchFromBCVAPI(): Promise<number | null> {
    try {
      // Intentar primero con DolarVZLA (nuevo endpoint más actualizado)
      this.logger.log('Obteniendo tasa BCV desde DolarVZLA...');

      try {
        const response = await this.axiosInstance.get<DolarVZLAResponse>(
          this.DOLAR_VZLA_API_URL,
        );

        const data = response.data;

        if (!data.current?.usd || data.current.usd <= 0) {
          this.logger.warn(
            'DolarVZLA devolvió un valor USD inválido, intentando fallback...',
          );
        } else {
          this.logger.log(
            `Tasa BCV obtenida desde DolarVZLA: ${data.current.usd} (fecha: ${data.current.date})`,
          );
          return data.current.usd;
        }
      } catch (dolarVzlaError: any) {
        this.logger.warn(
          `Error al obtener tasa desde DolarVZLA: ${dolarVzlaError.message}, intentando fallback...`,
        );
      }

      // Fallback al endpoint anterior si DolarVZLA falla
      this.logger.log('Obteniendo tasa BCV desde DolarAPI (fallback)...');

      const response = await this.axiosInstance.get<DolarAPIOfficialResponse>(
        this.DOLAR_API_URL,
      );

      const data = response.data;

      if (!data.promedio || data.promedio <= 0) {
        this.logger.warn('La API devolvió un promedio inválido');
        return null;
      }

      this.logger.log(
        `Tasa BCV obtenida desde DolarAPI: ${data.promedio} (actualizada: ${data.fechaActualizacion})`,
      );

      return data.promedio;
    } catch (error: any) {
      if (error.response) {
        this.logger.error(
          `Error HTTP al obtener tasa BCV: ${error.response.status}`,
        );
      } else if (error.request) {
        this.logger.error('Error de conexión al obtener tasa BCV');
      } else {
        this.logger.error(`Error al obtener tasa BCV: ${error.message}`);
      }
      return null;
    }
  }

  private isCacheValid(cacheKey: string): boolean {
    const cached = this.cachedRates.get(cacheKey);
    if (!cached) return false;
    const now = new Date();
    const cacheAge = now.getTime() - cached.timestamp.getTime();
    return cacheAge < this.CACHE_DURATION_MS;
  }

  async getActiveManualRate(storeId: string): Promise<ExchangeRate | null> {
    try {
      if (!storeId) return null;

      const now = new Date();

      return await this.exchangeRateRepository
        .createQueryBuilder('rate')
        .where('rate.store_id = :storeId', { storeId })
        .andWhere('rate.source = :source', { source: 'manual' })
        .andWhere('rate.rate_type = :rateType', { rateType: 'BCV' })
        .andWhere('rate.is_active = :isActive', { isActive: true })
        .andWhere('rate.effective_from <= :now', { now })
        .andWhere(
          '(rate.effective_until IS NULL OR rate.effective_until >= :now)',
          { now },
        )
        .orderBy('rate.is_preferred', 'DESC')
        .addOrderBy('rate.effective_from', 'DESC')
        .getOne();
    } catch (error) {
      this.logger.error('Error en getActiveManualRate', error);
      return null;
    }
  }

  async getLastManualRate(storeId: string): Promise<ExchangeRate | null> {
    try {
      if (!storeId) return null;

      return await this.exchangeRateRepository.findOne({
        where: {
          store_id: storeId,
          source: 'manual',
        },
        order: {
          effective_from: 'DESC',
        },
      });
    } catch (error) {
      this.logger.error('Error en getLastManualRate', error);
      return null;
    }
  }

  private async saveApiRate(
    storeId: string,
    rate: number,
  ): Promise<ExchangeRate> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await this.exchangeRateRepository
      .createQueryBuilder('rate')
      .where('rate.store_id = :storeId', { storeId })
      .andWhere('rate.source = :source', { source: 'api' })
      .andWhere('rate.rate_type = :rateType', { rateType: 'BCV' })
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
      rate_type: 'BCV',
      is_preferred: false,
      effective_from: now,
      effective_until: null,
      is_active: true,
    });

    return this.exchangeRateRepository.save(exchangeRate);
  }

  async getRateHistory(
    storeId: string,
    limit: number = 50,
    offset: number = 0,
    rateType?: ExchangeRateType,
  ): Promise<{ rates: ExchangeRate[]; total: number }> {
    const query = this.exchangeRateRepository
      .createQueryBuilder('rate')
      .where('rate.store_id = :storeId', { storeId });

    if (rateType) {
      query.andWhere('rate.rate_type = :rateType', { rateType });
    }

    query.orderBy('rate.effective_from', 'DESC');

    const total = await query.getCount();
    query.limit(limit).offset(offset);

    const rates = await query.getMany();

    return { rates, total };
  }

  getCachedRate(): BCVRateResponse | null {
    const globalCache = this.cachedRates.get('global-BCV');
    if (globalCache && this.isCacheValid('global-BCV')) {
      return globalCache;
    }
    return null;
  }
}
