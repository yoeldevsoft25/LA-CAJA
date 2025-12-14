import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

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

  constructor(private configService: ConfigService) {
    this.axiosInstance = axios.create({
      timeout: 5000, // 5 segundos timeout
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Intenta obtener la tasa del BCV de fuentes automáticas
   * Retorna null si no puede obtenerla automáticamente
   */
  async getBCVRate(): Promise<BCVRateResponse | null> {
    // Si hay un cache válido, retornarlo
    if (this.cachedRate && this.isCacheValid()) {
      this.logger.log('Usando tasa BCV del cache');
      return this.cachedRate;
    }

    // Intentar obtener de diferentes fuentes
    try {
      // Opción 1: API de BCV (si existe)
      const rate = await this.fetchFromBCVAPI();
      if (rate) {
        this.cachedRate = {
          rate,
          source: 'api',
          timestamp: new Date(),
        };
        this.logger.log(`Tasa BCV obtenida: ${rate}`);
        return this.cachedRate;
      }
    } catch (error) {
      this.logger.warn('Error al obtener tasa del BCV:', error);
    }

    // Si no se pudo obtener, retornar null
    // El frontend deberá solicitar entrada manual
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
        this.DOLAR_API_URL
      );

      const data = response.data;

      // Validar que tenemos un promedio válido
      if (!data.promedio || data.promedio <= 0) {
        this.logger.warn('La API devolvió un promedio inválido');
        return null;
      }

      this.logger.log(
        `Tasa BCV obtenida: ${data.promedio} (actualizada: ${data.fechaActualizacion})`
      );

      return data.promedio;
    } catch (error: any) {
      if (error.response) {
        this.logger.error(
          `Error HTTP al obtener tasa BCV: ${error.response.status} - ${error.response.statusText}`
        );
      } else if (error.request) {
        this.logger.error('Error de conexión al obtener tasa BCV (sin respuesta)');
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
   * Permite establecer manualmente la tasa BCV (para cache manual)
   */
  setManualRate(rate: number): void {
    this.cachedRate = {
      rate,
      source: 'manual',
      timestamp: new Date(),
    };
    this.logger.log(`Tasa BCV establecida manualmente: ${rate}`);
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

