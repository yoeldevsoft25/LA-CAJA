import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Store } from '../database/entities/store.entity';
import { Warehouse } from '../database/entities/warehouse.entity';
import { PriceList } from '../database/entities/price-list.entity';
import { InvoiceSeries } from '../database/entities/invoice-series.entity';
import { ChartOfAccountsService } from '../accounting/chart-of-accounts.service';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { FiscalConfigsService } from '../fiscal-configs/fiscal-configs.service';
import { PaymentMethodConfigsService } from '../payments/payment-method-configs.service';
import { CreateFiscalConfigDto } from '../fiscal-configs/dto/create-fiscal-config.dto';
import {
  CreatePaymentMethodConfigDto,
  PaymentMethod,
} from '../payments/dto/create-payment-method-config.dto';

export type BusinessType = 'retail' | 'services' | 'restaurant' | 'general';

export interface SetupConfig {
  business_type?: BusinessType;
  business_name?: string;
  fiscal_id?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: 'BS' | 'USD' | 'MIXED';
}

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(PriceList)
    private priceListRepository: Repository<PriceList>,
    @InjectRepository(InvoiceSeries)
    private invoiceSeriesRepository: Repository<InvoiceSeries>,
    @InjectRepository(ChartOfAccount)
    private chartOfAccountRepository: Repository<ChartOfAccount>,
    private chartOfAccountsService: ChartOfAccountsService,
    private fiscalConfigsService: FiscalConfigsService,
    private paymentMethodConfigsService: PaymentMethodConfigsService,
  ) {}

  /**
   * Configuración automática completa para una nueva tienda
   */
  async setupStore(
    storeId: string,
    userId: string,
    config: SetupConfig = {},
  ): Promise<{
    success: boolean;
    steps_completed: string[];
    steps_failed: string[];
    details: {
      warehouse_created?: boolean;
      price_list_created?: boolean;
      chart_of_accounts_initialized?: boolean;
      invoice_series_created?: boolean;
      fiscal_config_created?: boolean;
      payment_methods_configured?: boolean;
    };
  }> {
    const stepsCompleted: string[] = [];
    const stepsFailed: string[] = [];
    const details: any = {};

    try {
      // 1. Crear Almacén Principal
      try {
        await this.createDefaultWarehouse(storeId, userId);
        stepsCompleted.push('warehouse');
        details.warehouse_created = true;
      } catch (error) {
        this.logger.error(`Error creando almacén: ${error}`);
        stepsFailed.push('warehouse');
        details.warehouse_created = false;
      }

      // 2. Crear Lista de Precios Principal
      try {
        await this.createDefaultPriceList(storeId, userId);
        stepsCompleted.push('price_list');
        details.price_list_created = true;
      } catch (error) {
        this.logger.error(`Error creando lista de precios: ${error}`);
        stepsFailed.push('price_list');
        details.price_list_created = false;
      }

      // 3. Inicializar Plan de Cuentas (con template según tipo de negocio)
      try {
        const businessType = config.business_type || 'general';
        await this.initializeChartOfAccounts(storeId, userId, businessType);
        stepsCompleted.push('chart_of_accounts');
        details.chart_of_accounts_initialized = true;
      } catch (error) {
        this.logger.error(`Error inicializando plan de cuentas: ${error}`);
        stepsFailed.push('chart_of_accounts');
        details.chart_of_accounts_initialized = false;
      }

      // 4. Crear Serie de Factura Principal
      try {
        await this.createDefaultInvoiceSeries(storeId, userId, config);
        stepsCompleted.push('invoice_series');
        details.invoice_series_created = true;
      } catch (error) {
        this.logger.error(`Error creando serie de factura: ${error}`);
        stepsFailed.push('invoice_series');
        details.invoice_series_created = false;
      }

      // 5. Crear Configuración Fiscal
      try {
        await this.createDefaultFiscalConfig(storeId, config);
        stepsCompleted.push('fiscal_config');
        details.fiscal_config_created = true;
      } catch (error) {
        this.logger.error(`Error creando configuración fiscal: ${error}`);
        stepsFailed.push('fiscal_config');
        details.fiscal_config_created = false;
      }

      // 6. Configurar Métodos de Pago Básicos
      try {
        await this.createDefaultPaymentMethods(storeId);
        stepsCompleted.push('payment_methods');
        details.payment_methods_configured = true;
      } catch (error) {
        this.logger.error(`Error configurando métodos de pago: ${error}`);
        stepsFailed.push('payment_methods');
        details.payment_methods_configured = false;
      }

      return {
        success: stepsFailed.length === 0,
        steps_completed: stepsCompleted,
        steps_failed: stepsFailed,
        details,
      };
    } catch (error) {
      this.logger.error(`Error en setup de tienda ${storeId}:`, error);
      throw new BadRequestException(`Error durante la configuración: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Crear almacén por defecto
   */
  private async createDefaultWarehouse(storeId: string, userId: string): Promise<Warehouse> {
    const existing = await this.warehouseRepository.findOne({
      where: { store_id: storeId, is_default: true },
    });

    if (existing) {
      return existing;
    }

    const warehouse = this.warehouseRepository.create({
      id: randomUUID(),
      store_id: storeId,
      name: 'Almacén Principal',
      code: 'ALM-001',
      description: 'Almacén principal de la tienda',
      is_default: true,
      is_active: true,
      address: null,
      note: null,
    });

    return this.warehouseRepository.save(warehouse);
  }

  /**
   * Crear lista de precios por defecto
   */
  private async createDefaultPriceList(storeId: string, userId: string): Promise<PriceList> {
    const existing = await this.priceListRepository.findOne({
      where: { store_id: storeId, is_default: true },
    });

    if (existing) {
      return existing;
    }

    const priceList = this.priceListRepository.create({
      id: randomUUID(),
      store_id: storeId,
      name: 'Lista Principal',
      code: 'LP-001',
      description: 'Lista de precios principal',
      is_default: true,
      is_active: true,
      valid_from: new Date(),
      valid_until: null,
    });

    return this.priceListRepository.save(priceList);
  }

  /**
   * Inicializar plan de cuentas con template según tipo de negocio
   */
  private async initializeChartOfAccounts(
    storeId: string,
    userId: string,
    businessType: BusinessType,
  ): Promise<void> {
    await this.chartOfAccountsService.initializeDefaultChartOfAccounts(storeId, userId, businessType);
  }

  /**
   * Crear serie de factura por defecto
   */
  private async createDefaultInvoiceSeries(
    storeId: string,
    userId: string,
    config: SetupConfig,
  ): Promise<InvoiceSeries> {
    const existing = await this.invoiceSeriesRepository.findOne({
      where: { store_id: storeId, is_active: true },
    });

    if (existing) {
      return existing;
    }

    const prefix = config.business_type === 'restaurant' ? 'FACT' : 'FACT';
    const fiscalId = config.fiscal_id || 'J-00000000-0';

    const invoiceSeries = this.invoiceSeriesRepository.create({
      id: randomUUID(),
      store_id: storeId,
      series_code: 'A',
      name: 'Serie Principal',
      prefix: prefix,
      start_number: 1,
      current_number: 0,
      is_active: true,
      note: `Serie creada automáticamente durante el setup`,
    });

    return this.invoiceSeriesRepository.save(invoiceSeries);
  }

  /**
   * Crear configuración fiscal por defecto
   */
  private async createDefaultFiscalConfig(
    storeId: string,
    config: SetupConfig,
  ): Promise<void> {
    const existing = await this.fiscalConfigsService.findOne(storeId);

    if (existing) {
      // Ya existe configuración fiscal, no hacer nada
      return;
    }

    const fiscalConfigDto: CreateFiscalConfigDto = {
      tax_id: config.fiscal_id || 'J-00000000-0',
      business_name: config.business_name || 'Mi Negocio',
      business_address: config.address || 'Dirección no especificada',
      business_phone: config.phone || undefined,
      business_email: config.email || undefined,
      default_tax_rate: 16.0,
    };

    await this.fiscalConfigsService.upsert(storeId, fiscalConfigDto);
  }

  /**
   * Crear métodos de pago básicos por defecto
   */
  private async createDefaultPaymentMethods(storeId: string): Promise<void> {
    const defaultMethods: Array<{
      method: PaymentMethod;
      sortOrder: number;
    }> = [
      { method: 'CASH_BS' as PaymentMethod, sortOrder: 20 },
      { method: 'CASH_USD' as PaymentMethod, sortOrder: 10 },
      { method: 'PAGO_MOVIL' as PaymentMethod, sortOrder: 30 },
    ];

    for (const { method, sortOrder } of defaultMethods) {
      const existing = await this.paymentMethodConfigsService.getConfig(
        storeId,
        method,
      );

      if (!existing) {
        const paymentMethodDto: CreatePaymentMethodConfigDto = {
          method: method,
          enabled: true,
          requires_authorization: false,
          sort_order: sortOrder,
          min_amount_bs: null,
          min_amount_usd: null,
          max_amount_bs: null,
          max_amount_usd: null,
          commission_percentage: 0,
        };

        await this.paymentMethodConfigsService.upsertConfig(
          storeId,
          paymentMethodDto,
        );
      }
    }
  }

  /**
   * Validar configuración completa de una tienda (prerrequisitos para ventas con fiscal/contable).
   * Incluye: warehouse, invoice_series, fiscal_config, payment_methods, chart_of_accounts,
   * y accounting_account_mappings (sale_revenue, sale_cost como mínimo para generateEntryFromSale).
   */
  async validateSetup(storeId: string): Promise<{
    is_complete: boolean;
    missing_steps: string[];
    details: {
      has_warehouse: boolean;
      has_price_list: boolean;
      has_chart_of_accounts: boolean;
      has_invoice_series: boolean;
      has_fiscal_config: boolean;
      has_payment_methods: boolean;
      has_accounting_mappings: boolean;
      accounting_mappings: {
        sale_revenue: boolean;
        sale_cost: boolean;
        cash_asset: boolean;
        accounts_receivable: boolean;
        inventory_asset: boolean;
      };
      has_products?: boolean;
    };
  }> {
    // Al menos una bodega activa (getDefaultOrFirst usa is_default o la primera activa)
    const warehouse = await this.warehouseRepository.findOne({
      where: { store_id: storeId, is_active: true },
    });

    const priceList = await this.priceListRepository.findOne({
      where: { store_id: storeId, is_default: true, is_active: true },
    });

    const invoiceSeries = await this.invoiceSeriesRepository.findOne({
      where: { store_id: storeId, is_active: true },
    });

    // Verificar si hay cuentas contables
    const chartOfAccountsCount = await this.chartOfAccountRepository.count({
      where: { store_id: storeId, is_active: true },
    });

    // Verificar configuración fiscal
    const fiscalConfig = await this.fiscalConfigsService.findOne(storeId);

    // Verificar métodos de pago habilitados
    const paymentMethods = await this.paymentMethodConfigsService.getConfigs(
      storeId,
    );
    const enabledPaymentMethods = paymentMethods.filter((pm) => pm.enabled);

    // Mapeos contables para asientos de venta (sale_revenue y sale_cost obligatorios)
    const mappings = await this.chartOfAccountsService.getRequiredMappingsForSales(storeId);

    const missingSteps: string[] = [];
    if (!warehouse) missingSteps.push('warehouse');
    if (!priceList) missingSteps.push('price_list');
    if (chartOfAccountsCount === 0) missingSteps.push('chart_of_accounts');
    if (!invoiceSeries) missingSteps.push('invoice_series');
    if (!fiscalConfig) missingSteps.push('fiscal_config');
    if (enabledPaymentMethods.length === 0)
      missingSteps.push('payment_methods');
    if (!mappings.canGenerateSaleEntries) missingSteps.push('accounting_mappings');

    return {
      is_complete: missingSteps.length === 0,
      missing_steps: missingSteps,
      details: {
        has_warehouse: !!warehouse,
        has_price_list: !!priceList,
        has_chart_of_accounts: chartOfAccountsCount > 0,
        has_invoice_series: !!invoiceSeries,
        has_fiscal_config: !!fiscalConfig,
        has_payment_methods: enabledPaymentMethods.length > 0,
        has_accounting_mappings: mappings.canGenerateSaleEntries,
        accounting_mappings: {
          sale_revenue: mappings.sale_revenue,
          sale_cost: mappings.sale_cost,
          cash_asset: mappings.cash_asset,
          accounts_receivable: mappings.accounts_receivable,
          inventory_asset: mappings.inventory_asset,
        },
      },
    };
  }
}