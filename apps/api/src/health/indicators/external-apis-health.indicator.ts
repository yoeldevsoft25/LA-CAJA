import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class ExternalApisHealthIndicator extends HealthIndicator {
  private axiosInstance: AxiosInstance;
  private readonly DOLAR_VZLA_API_URL =
    'https://api.dolarvzla.com/public/exchange-rate';
  private readonly DOLAR_API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';

  constructor(private configService: ConfigService) {
    super();
    this.axiosInstance = axios.create({
      timeout: 5000,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const checks: Record<string, any> = {};
    let allHealthy = true;
    const requireHealthy =
      this.configService.get<string>('EXTERNAL_APIS_HEALTH_REQUIRED') ===
      'true';

    // Ejecutar verificaciones en paralelo
    const checkPromises: Promise<void>[] = [];

    // 1. Verificación API de tasas de cambio (BCV)
    const bcvSources = [
      { name: 'dolarvzla', url: this.DOLAR_VZLA_API_URL },
      { name: 'dolarapi', url: this.DOLAR_API_URL },
    ];
    let bcvHealthy = false;
    checks.bcv = { status: 'down', sources: {} as Record<string, any> };

    const bcvCheckPromise = (async () => {
      const bcvSourcePromises = bcvSources.map(async (source) => {
        try {
          const startTime = Date.now();
          const response = await this.axiosInstance.get(source.url, {
            timeout: 5000,
            validateStatus: () => true,
          });
          const responseTime = Date.now() - startTime;
          const sourceHealthy = response.status < 500;
          if (sourceHealthy) bcvHealthy = true;
          checks.bcv.sources[source.name] = {
            status: sourceHealthy ? 'up' : 'down',
            httpStatus: response.status,
            responseTime: `${responseTime}ms`,
          };
        } catch (error: any) {
          checks.bcv.sources[source.name] = {
            status: 'down',
            error: error instanceof Error ? error.message : 'Unknown error',
            code: error?.code,
          };
        }
      });

      await Promise.all(bcvSourcePromises);
      checks.bcv.status = bcvHealthy ? 'up' : 'down';
      if (!bcvHealthy) allHealthy = false;
    })();
    checkPromises.push(bcvCheckPromise);

    // 2. Verificar servicio de email (Resend)
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    if (resendApiKey) {
      const resendCheckPromise = (async () => {
        try {
          const startTime = Date.now();
          const response = await this.axiosInstance.get(
            'https://api.resend.com/domains',
            {
              headers: { Authorization: `Bearer ${resendApiKey}` },
              timeout: 5000,
              validateStatus: () => true,
            },
          );
          const responseTime = Date.now() - startTime;
          const resendHealthy = response.status === 200;
          checks.resend = {
            status: resendHealthy ? 'up' : 'down',
            httpStatus: response.status,
            responseTime: `${responseTime}ms`,
          };
          if (!resendHealthy) allHealthy = false;
        } catch (error) {
          checks.resend = {
            status: 'down',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          allHealthy = false;
        }
      })();
      checkPromises.push(resendCheckPromise);
    } else {
      checks.resend = {
        status: 'skipped',
      };
    }

    // 3. Verificar WhatsApp (si está configurado)
    const whatsappEnabled =
      this.configService.get<string>('WHATSAPP_ENABLED') === 'true';
    if (whatsappEnabled) {
      checks.whatsapp = {
        status: 'up',
      };
    } else {
      checks.whatsapp = {
        status: 'skipped',
      };
    }

    // Esperar a que terminen todas las verificaciones
    await Promise.all(checkPromises);

    if (!allHealthy && requireHealthy) {
      throw new HealthCheckError(
        'Some external APIs are unhealthy',
        this.getStatus(key, false, checks),
      );
    }

    return this.getStatus(key, true, {
      degraded: !allHealthy,
      checks,
    });
  }
}
