import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { FiscalConfig } from '../database/entities/fiscal-config.entity';

/**
 * Interfaz para la respuesta del SENIAT al emitir una factura
 */
export interface SeniatIssueInvoiceResponse {
  fiscal_number: string;
  fiscal_control_code: string;
  fiscal_qr_code: string;
  authorization_number: string;
  issued_at: Date;
}

/**
 * Interfaz para los datos de factura a transmitir al SENIAT
 */
export interface SeniatInvoiceData {
  invoice_number: string;
  invoice_type: 'invoice' | 'credit_note' | 'debit_note';
  issuer_tax_id: string;
  issuer_name: string;
  issuer_address: string | null;
  customer_tax_id: string | null;
  customer_name: string | null;
  subtotal_bs: number;
  subtotal_usd: number;
  tax_amount_bs: number;
  tax_amount_usd: number;
  tax_rate: number;
  total_bs: number;
  total_usd: number;
  exchange_rate: number;
  currency: string;
  items: Array<{
    product_name: string;
    product_code: string | null;
    quantity: number;
    unit_price_bs: number;
    unit_price_usd: number;
    subtotal_bs: number;
    subtotal_usd: number;
    tax_amount_bs: number;
    tax_amount_usd: number;
  }>;
  payment_method: string | null;
  issued_at: Date;
}

/**
 * Servicio para integración con el SENIAT
 *
 * Este servicio maneja la comunicación con la API del SENIAT para:
 * - Emitir facturas fiscales
 * - Obtener códigos de control fiscal
 * - Generar códigos QR de verificación
 *
 * En modo desarrollo, genera códigos mock. En producción, se conecta a la API real del SENIAT.
 */
@Injectable()
export class SeniatIntegrationService {
  private readonly logger = new Logger(SeniatIntegrationService.name);
  private readonly seniatApiUrl: string;
  private readonly seniatApiKey: string | null;
  private readonly isMockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.seniatApiUrl = this.configService.get<string>('SENIAT_API_URL') || '';
    this.seniatApiKey =
      this.configService.get<string>('SENIAT_API_KEY') || null;
    // Modo mock si no hay configuración o si está explícitamente habilitado
    this.isMockMode =
      !this.seniatApiUrl ||
      !this.seniatApiKey ||
      this.configService.get<string>('SENIAT_MOCK_MODE') === 'true';

    if (this.isMockMode) {
      this.logger.warn(
        '⚠️  Modo MOCK activado para integración SENIAT. Los códigos fiscales serán generados localmente.',
      );
    } else {
      this.logger.log('✅ Integración SENIAT configurada con API real');
    }
  }

  /**
   * Emite una factura fiscal en el SENIAT
   *
   * Transmite los datos de la factura al SENIAT y obtiene:
   * - Número fiscal único
   * - Código de control fiscal
   * - Código QR para verificación
   *
   * @param invoice - Factura fiscal a emitir
   * @param fiscalConfig - Configuración fiscal de la tienda
   * @returns Datos fiscales generados por el SENIAT
   */
  async issueInvoice(
    invoice: FiscalInvoice,
    fiscalConfig: FiscalConfig,
  ): Promise<SeniatIssueInvoiceResponse> {
    try {
      // Preparar datos para el SENIAT
      const invoiceData = this.prepareInvoiceData(invoice, fiscalConfig);

      if (this.isMockMode) {
        return await this.issueInvoiceMock(invoiceData, invoice);
      }

      return await this.issueInvoiceReal(invoiceData, fiscalConfig);
    } catch (error) {
      this.logger.error('Error emitiendo factura en SENIAT', error);
      throw new BadRequestException(
        `Error al emitir factura en SENIAT: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      );
    }
  }

  /**
   * Prepara los datos de la factura para transmitir al SENIAT
   */
  private prepareInvoiceData(
    invoice: FiscalInvoice,
    _fiscalConfig: FiscalConfig,
  ): SeniatInvoiceData {
    return {
      invoice_number: invoice.invoice_number,
      invoice_type: invoice.invoice_type,
      issuer_tax_id: invoice.issuer_tax_id,
      issuer_name: invoice.issuer_name,
      issuer_address: invoice.issuer_address,
      customer_tax_id: invoice.customer_tax_id,
      customer_name: invoice.customer_name,
      subtotal_bs: Number(invoice.subtotal_bs),
      subtotal_usd: Number(invoice.subtotal_usd),
      tax_amount_bs: Number(invoice.tax_amount_bs),
      tax_amount_usd: Number(invoice.tax_amount_usd),
      tax_rate: Number(invoice.tax_rate),
      total_bs: Number(invoice.total_bs),
      total_usd: Number(invoice.total_usd),
      exchange_rate: Number(invoice.exchange_rate),
      currency: invoice.currency,
      items:
        invoice.items?.map((item) => ({
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          unit_price_bs: Number(item.unit_price_bs),
          unit_price_usd: Number(item.unit_price_usd),
          subtotal_bs: Number(item.subtotal_bs),
          subtotal_usd: Number(item.subtotal_usd),
          tax_amount_bs: Number(item.tax_amount_bs),
          tax_amount_usd: Number(item.tax_amount_usd),
        })) || [],
      payment_method: invoice.payment_method,
      issued_at: invoice.issued_at || new Date(),
    };
  }

  /**
   * Emite factura en modo MOCK (desarrollo/testing)
   *
   * Genera códigos fiscales simulados para desarrollo sin necesidad de conexión al SENIAT.
   */
  private async issueInvoiceMock(
    invoiceData: SeniatInvoiceData,
    invoice: FiscalInvoice,
  ): Promise<SeniatIssueInvoiceResponse> {
    this.logger.debug('Generando factura fiscal en modo MOCK');

    // Phase 3: Usar el número fiscal provisto si existe (escenario offline-safe)
    let fiscalNumber = (invoice as any).fiscal_number;
    if (!fiscalNumber) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const random = Math.floor(Math.random() * 999999)
        .toString()
        .padStart(6, '0');
      fiscalNumber = `${year}${month}${day}-${random}`;
    }

    // Generar código de control fiscal (algoritmo simplificado)
    const controlCode = this.generateControlCode(invoiceData);

    // Generar código QR como imagen base64
    const qrData = {
      fiscal_number: fiscalNumber,
      control_code: controlCode,
      invoice_number: invoiceData.invoice_number,
      issuer_tax_id: invoiceData.issuer_tax_id,
      total_bs: invoiceData.total_bs,
      issued_at: invoiceData.issued_at.toISOString(),
    };

    // Generar QR code como imagen base64
    let fiscalQrCode: string;
    try {
      fiscalQrCode = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
      });
    } catch (error) {
      this.logger.error('Error generando QR code', error);
      // Si falla, usar JSON como fallback
      fiscalQrCode = JSON.stringify(qrData);
    }

    return {
      fiscal_number: fiscalNumber,
      fiscal_control_code: controlCode,
      fiscal_qr_code: fiscalQrCode,
      authorization_number: 'MOCK-AUTH-' + Date.now(),
      issued_at: invoiceData.issued_at,
    };
  }

  /**
   * Emite factura en el SENIAT real
   *
   * Realiza la llamada HTTP a la API del SENIAT para emitir la factura.
   *
   * NOTA: Esta implementación es un template. Debe adaptarse según la documentación
   * oficial de la API del SENIAT cuando esté disponible.
   */
  private async issueInvoiceReal(
    invoiceData: SeniatInvoiceData,
    _fiscalConfig: FiscalConfig,
  ): Promise<SeniatIssueInvoiceResponse> {
    this.logger.log(
      `Transmitiendo factura ${invoiceData.invoice_number} al SENIAT`,
    );

    // TODO: Implementar llamada real a la API del SENIAT
    // Ejemplo de estructura (adaptar según documentación oficial):
    /*
    const response = await fetch(`${this.seniatApiUrl}/api/v1/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.seniatApiKey}`,
        'X-Authorization-Number': fiscalConfig.fiscal_authorization_number || '',
      },
      body: JSON.stringify({
        invoice: invoiceData,
        store_config: {
          tax_id: fiscalConfig.tax_id,
          authorization_number: fiscalConfig.fiscal_authorization_number,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`SENIAT API error: ${error.message || response.statusText}`);
    }

    const result = await response.json();
    
    return {
      fiscal_number: result.fiscal_number,
      fiscal_control_code: result.control_code,
      fiscal_qr_code: result.qr_code,
      authorization_number: result.authorization_number,
      issued_at: new Date(result.issued_at),
    };
    */

    // Por ahora, lanzar error indicando que debe configurarse
    throw new BadRequestException(
      'Integración con SENIAT no configurada. Configure SENIAT_API_URL y SENIAT_API_KEY, o use SENIAT_MOCK_MODE=true para desarrollo.',
    );
  }

  /**
   * Genera un código de control fiscal (algoritmo simplificado para MOCK)
   *
   * En producción, el SENIAT genera este código. Aquí usamos un algoritmo
   * simplificado basado en los datos de la factura.
   */
  private generateControlCode(invoiceData: SeniatInvoiceData): string {
    // Algoritmo simplificado: hash de datos clave
    const data = [
      invoiceData.invoice_number,
      invoiceData.issuer_tax_id,
      invoiceData.total_bs.toString(),
      invoiceData.issued_at.toISOString(),
    ].join('|');

    // Generar hash simple (en producción, el SENIAT usa su propio algoritmo)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convertir a 32bit integer
    }

    // Convertir a string alfanumérico (base36)
    const hashStr = Math.abs(hash).toString(36).toUpperCase();
    return hashStr.padStart(10, '0').substring(0, 10);
  }

  /**
   * Valida que la configuración fiscal esté completa
   */
  validateFiscalConfig(fiscalConfig: FiscalConfig): void {
    if (!fiscalConfig.tax_id) {
      throw new BadRequestException('RIF de la tienda no configurado');
    }
    if (!fiscalConfig.business_name) {
      throw new BadRequestException('Nombre del negocio no configurado');
    }
    if (!fiscalConfig.business_address) {
      throw new BadRequestException('Dirección del negocio no configurada');
    }
    if (!this.isMockMode && !fiscalConfig.fiscal_authorization_number) {
      throw new BadRequestException(
        'Número de autorización fiscal requerido para emisión real',
      );
    }
  }
}
