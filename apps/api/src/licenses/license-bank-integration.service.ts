import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import {
  VerificationMethod,
  VerificationStatus,
} from '../database/entities/license-payment-verification.entity';
import { LicensePayment } from '../database/entities/license-payment.entity';

interface VerificationResult {
  success: boolean;
  status: VerificationStatus;
  responseData?: any;
  errorMessage?: string;
}

@Injectable()
export class LicenseBankIntegrationService {
  private readonly logger = new Logger(LicenseBankIntegrationService.name);
  private mercantilApi: AxiosInstance | null = null;
  private banescoApi: AxiosInstance | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeApis();
  }

  private initializeApis() {
    // Inicializar API de Mercantil si está habilitada
    const mercantilEnabled =
      this.configService.get<string>('MERCANTIL_API_ENABLED') === 'true';
    if (mercantilEnabled) {
      const clientId = this.configService.get<string>('MERCANTIL_CLIENT_ID');
      const secretKey = this.configService.get<string>('MERCANTIL_SECRET_KEY');
      const apiUrl =
        this.configService.get<string>('MERCANTIL_API_URL') ||
        'https://api.mercantilbanco.com';

      if (clientId && secretKey) {
        this.mercantilApi = axios.create({
          baseURL: apiUrl,
          headers: {
            'Content-Type': 'application/json',
            ClientID: clientId,
          },
          timeout: 10000,
        });
        this.logger.log('API de Mercantil inicializada');
      } else {
        this.logger.warn(
          'MERCANTIL_API_ENABLED=true pero faltan credenciales (MERCANTIL_CLIENT_ID o MERCANTIL_SECRET_KEY)',
        );
      }
    }

    // Inicializar API de Banesco si está habilitada
    const banescoEnabled =
      this.configService.get<string>('BANESCO_API_ENABLED') === 'true';
    if (banescoEnabled) {
      const apiKey = this.configService.get<string>('BANESCO_API_KEY');
      const apiUrl =
        this.configService.get<string>('BANESCO_API_URL') ||
        'https://api.banesco.com';

      if (apiKey) {
        this.banescoApi = axios.create({
          baseURL: apiUrl,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 10000,
        });
        this.logger.log('API de Banesco inicializada');
      } else {
        this.logger.warn('BANESCO_API_ENABLED=true pero falta BANESCO_API_KEY');
      }
    }
  }

  /**
   * Verifica un pago usando la API de Mercantil
   */
  async verifyMercantil(payment: LicensePayment): Promise<VerificationResult> {
    if (!this.mercantilApi) {
      return {
        success: false,
        status: VerificationStatus.ERROR,
        errorMessage: 'API de Mercantil no está configurada',
      };
    }

    try {
      const secretKey = this.configService.get<string>('MERCANTIL_SECRET_KEY');
      if (!secretKey) {
        throw new Error('MERCANTIL_SECRET_KEY no configurada');
      }

      // Preparar payload según documentación de Mercantil
      // Parámetros: payment_reference, phone_number, bank_code, date_range, amount
      const payload = {
        payment_reference: payment.payment_reference,
        phone_number: payment.phone_number || undefined,
        bank_code: payment.bank_code || undefined,
        amount: payment.amount_usd,
        // Rango de fechas: últimos 7 días
        date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        date_to: new Date().toISOString(),
      };

      // Encriptar según especificación de Mercantil (AES/ECB/PKCS5Padding)
      // Hash SHA-256 de la secret key, tomar primeros 16 bytes
      const keyHash = crypto
        .createHash('sha256')
        .update(secretKey)
        .digest('hex')
        .substring(0, 16);

      const cipher = crypto.createCipheriv(
        'aes-128-ecb',
        Buffer.from(keyHash, 'hex'),
        null,
      );
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload), 'utf8'),
        cipher.final(),
      ]);
      const encryptedBase64 = encrypted.toString('base64');

      // Realizar la solicitud
      const response = await this.mercantilApi.post(
        '/v1/payments/search',
        {
          encrypted_data: encryptedBase64,
        },
        {
          headers: {
            'X-Signature': this.generateMercantilSignature(
              encryptedBase64,
              secretKey,
            ),
          },
        },
      );

      // Procesar respuesta
      if (response.data && response.data.transaction) {
        const transaction = response.data.transaction;
        // Verificar que coincidan los datos
        const matches =
          transaction.reference === payment.payment_reference &&
          Math.abs(parseFloat(transaction.amount) - payment.amount_usd) < 0.01;

        if (matches) {
          return {
            success: true,
            status: VerificationStatus.SUCCESS,
            responseData: transaction,
          };
        } else {
          return {
            success: false,
            status: VerificationStatus.NOT_FOUND,
            errorMessage:
              'Transacción encontrada pero no coincide con los datos',
            responseData: transaction,
          };
        }
      } else {
        return {
          success: false,
          status: VerificationStatus.NOT_FOUND,
          errorMessage: 'Transacción no encontrada',
        };
      }
    } catch (error: any) {
      this.logger.error(
        `Error verificando con Mercantil: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        status: VerificationStatus.ERROR,
        errorMessage: error.message || 'Error desconocido en API de Mercantil',
      };
    }
  }

  /**
   * Verifica un pago usando la API de Banesco
   */
  async verifyBanesco(payment: LicensePayment): Promise<VerificationResult> {
    if (!this.banescoApi) {
      return {
        success: false,
        status: VerificationStatus.ERROR,
        errorMessage: 'API de Banesco no está configurada',
      };
    }

    try {
      // Preparar payload según documentación de Banesco
      const payload = {
        reference: payment.payment_reference,
        phone_number: payment.phone_number || undefined,
        bank: payment.bank_code || undefined,
        account_number: payment.account_number || undefined,
        date: payment.created_at.toISOString().split('T')[0],
        amount: payment.amount_usd,
      };

      const response = await this.banescoApi.post(
        '/v1/transactions/confirm',
        payload,
      );

      // Procesar respuesta
      if (response.data && response.data.status === 'confirmed') {
        const transaction = response.data.transaction;
        // Verificar que coincidan los datos
        const matches =
          transaction.reference === payment.payment_reference &&
          Math.abs(parseFloat(transaction.amount) - payment.amount_usd) < 0.01;

        if (matches) {
          return {
            success: true,
            status: VerificationStatus.SUCCESS,
            responseData: transaction,
          };
        } else {
          return {
            success: false,
            status: VerificationStatus.NOT_FOUND,
            errorMessage:
              'Transacción confirmada pero no coincide con los datos',
            responseData: transaction,
          };
        }
      } else {
        return {
          success: false,
          status: VerificationStatus.NOT_FOUND,
          errorMessage: response.data?.message || 'Transacción no confirmada',
        };
      }
    } catch (error: any) {
      this.logger.error(
        `Error verificando con Banesco: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        status: VerificationStatus.ERROR,
        errorMessage: error.message || 'Error desconocido en API de Banesco',
      };
    }
  }

  /**
   * Intenta verificar automáticamente según el método de pago
   */
  async verifyAutomatic(payment: LicensePayment): Promise<{
    result: VerificationResult;
    method: VerificationMethod;
  }> {
    // Determinar qué API usar según el banco o método de pago
    if (
      payment.bank_code &&
      ['0105', 'MERCANTIL'].includes(payment.bank_code.toUpperCase()) &&
      this.mercantilApi
    ) {
      const result = await this.verifyMercantil(payment);
      return { result, method: VerificationMethod.MERCANTIL_API };
    }

    if (
      payment.bank_code &&
      ['0134', 'BANESCO'].includes(payment.bank_code.toUpperCase()) &&
      this.banescoApi
    ) {
      const result = await this.verifyBanesco(payment);
      return { result, method: VerificationMethod.BANESCO_API };
    }

    // Si no hay API configurada o no coincide el banco, retornar error
    return {
      result: {
        success: false,
        status: VerificationStatus.ERROR,
        errorMessage: 'No hay API configurada para este banco o método de pago',
      },
      method: VerificationMethod.OTHER,
    };
  }

  /**
   * Genera firma para Mercantil API
   */
  private generateMercantilSignature(data: string, secretKey: string): string {
    return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
  }

  /**
   * Verifica si hay APIs configuradas
   */
  hasBankIntegration(): boolean {
    return this.mercantilApi !== null || this.banescoApi !== null;
  }
}
