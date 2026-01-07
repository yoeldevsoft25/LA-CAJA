import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceSeries } from '../database/entities/invoice-series.entity';
import { PaymentMethodConfig } from '../database/entities/payment-method-config.entity';
import { PriceList } from '../database/entities/price-list.entity';
import { Warehouse } from '../database/entities/warehouse.entity';

export interface ConfigurationStatus {
  isComplete: boolean;
  missingConfigurations: string[];
  warnings: string[];
  details: {
    invoiceSeries: {
      configured: boolean;
      activeCount: number;
      message?: string;
    };
    paymentMethods: {
      configured: boolean;
      count: number;
      message?: string;
    };
    priceList: {
      configured: boolean;
      hasDefault: boolean;
      count: number;
      message?: string;
    };
    warehouse: {
      configured: boolean;
      hasDefault: boolean;
      count: number;
      message?: string;
    };
  };
}

/**
 * Servicio de validación de configuración del sistema
 * Verifica que todas las configuraciones necesarias estén completas antes de operar
 */
@Injectable()
export class ConfigValidationService {
  private readonly logger = new Logger(ConfigValidationService.name);

  constructor(
    @InjectRepository(InvoiceSeries)
    private invoiceSeriesRepository: Repository<InvoiceSeries>,
    @InjectRepository(PaymentMethodConfig)
    private paymentMethodRepository: Repository<PaymentMethodConfig>,
    @InjectRepository(PriceList)
    private priceListRepository: Repository<PriceList>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
  ) {}

  /**
   * Valida que todas las configuraciones necesarias estén completas
   */
  async validateSystemConfiguration(
    storeId: string,
  ): Promise<ConfigurationStatus> {
    const missingConfigurations: string[] = [];
    const warnings: string[] = [];

    // 1. Validar series de factura
    const invoiceSeriesCount = await this.invoiceSeriesRepository.count({
      where: {
        store_id: storeId,
        is_active: true,
      },
    });

    const invoiceSeriesConfigured = invoiceSeriesCount > 0;
    if (!invoiceSeriesConfigured) {
      missingConfigurations.push('series_factura');
    }

    // 2. Validar métodos de pago
    const paymentMethodsCount = await this.paymentMethodRepository.count({
      where: {
        store_id: storeId,
        enabled: true,
      },
    });

    const paymentMethodsConfigured = paymentMethodsCount > 0;
    if (!paymentMethodsConfigured) {
      missingConfigurations.push('metodos_pago');
    }

    // 3. Validar lista de precios
    const priceLists = await this.priceListRepository.find({
      where: {
        store_id: storeId,
        is_active: true,
      },
    });

    const priceListConfigured = priceLists.length > 0;
    const hasDefaultPriceList = priceLists.some((pl) => pl.is_default);

    if (!priceListConfigured) {
      missingConfigurations.push('lista_precios');
    } else if (!hasDefaultPriceList) {
      warnings.push('No hay lista de precios predeterminada configurada');
    }

    // 4. Validar almacén
    const warehouses = await this.warehouseRepository.find({
      where: {
        store_id: storeId,
        is_active: true,
      },
    });

    const warehouseConfigured = warehouses.length > 0;
    const hasDefaultWarehouse = warehouses.some((w) => w.is_default);

    if (!warehouseConfigured) {
      missingConfigurations.push('almacen');
    } else if (!hasDefaultWarehouse) {
      warnings.push('No hay almacén predeterminado configurado');
    }

    const isComplete = missingConfigurations.length === 0;

    const status: ConfigurationStatus = {
      isComplete,
      missingConfigurations,
      warnings,
      details: {
        invoiceSeries: {
          configured: invoiceSeriesConfigured,
          activeCount: invoiceSeriesCount,
          message: invoiceSeriesConfigured
            ? `${invoiceSeriesCount} serie(s) de factura activa(s)`
            : 'No hay series de factura configuradas. Debes crear al menos una serie de factura activa.',
        },
        paymentMethods: {
          configured: paymentMethodsConfigured,
          count: paymentMethodsCount,
          message: paymentMethodsConfigured
            ? `${paymentMethodsCount} método(s) de pago activo(s)`
            : 'No hay métodos de pago configurados. Debes crear al menos un método de pago activo.',
        },
        priceList: {
          configured: priceListConfigured,
          hasDefault: hasDefaultPriceList,
          count: priceLists.length,
          message: !priceListConfigured
            ? 'No hay listas de precios configuradas. Debes crear al menos una lista de precios.'
            : !hasDefaultPriceList
              ? 'Tienes listas de precios pero ninguna está marcada como predeterminada.'
              : `${priceLists.length} lista(s) de precios configurada(s)`,
        },
        warehouse: {
          configured: warehouseConfigured,
          hasDefault: hasDefaultWarehouse,
          count: warehouses.length,
          message: !warehouseConfigured
            ? 'No hay almacenes configurados. Debes crear al menos un almacén.'
            : !hasDefaultWarehouse
              ? 'Tienes almacenes pero ninguno está marcado como predeterminado.'
              : `${warehouses.length} almacén(es) configurado(s)`,
        },
      },
    };

    if (!isComplete) {
      this.logger.warn(
        `Sistema no configurado completamente para tienda ${storeId}. Faltan: ${missingConfigurations.join(', ')}`,
      );
    }

    return status;
  }

  /**
   * Valida que se puede generar una venta
   * Retorna true si está todo configurado, false si falta algo
   */
  async canGenerateSale(storeId: string): Promise<boolean> {
    const status = await this.validateSystemConfiguration(storeId);
    return status.isComplete;
  }

  /**
   * Obtiene el mensaje de error detallado si falta configuración
   */
  async getConfigurationErrorMessage(storeId: string): Promise<string | null> {
    const status = await this.validateSystemConfiguration(storeId);

    if (status.isComplete) {
      return null;
    }

    const messages: string[] = [
      '⚠️ No se pueden generar ventas. Configuración incompleta:',
      '',
    ];

    if (!status.details.invoiceSeries.configured) {
      messages.push(`❌ Series de factura: ${status.details.invoiceSeries.message}`);
    }

    if (!status.details.paymentMethods.configured) {
      messages.push(`❌ Métodos de pago: ${status.details.paymentMethods.message}`);
    }

    if (!status.details.priceList.configured) {
      messages.push(`❌ Listas de precios: ${status.details.priceList.message}`);
    }

    if (!status.details.warehouse.configured) {
      messages.push(`❌ Almacenes: ${status.details.warehouse.message}`);
    }

    messages.push('');
    messages.push('📋 Por favor, completa la configuración antes de generar ventas.');

    return messages.join('\n');
  }
}
