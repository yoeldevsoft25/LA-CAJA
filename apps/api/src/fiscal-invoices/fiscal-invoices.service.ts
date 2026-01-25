import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  FiscalInvoice,
  FiscalInvoiceStatus,
} from '../database/entities/fiscal-invoice.entity';
import { FiscalInvoiceItem } from '../database/entities/fiscal-invoice-item.entity';
import { FiscalConfig } from '../database/entities/fiscal-config.entity';
import { Sale } from '../database/entities/sale.entity';
import { Customer } from '../database/entities/customer.entity';
import { Product } from '../database/entities/product.entity';
import { InvoiceSeriesService } from '../invoice-series/invoice-series.service';
import { CreateFiscalInvoiceDto } from './dto/create-fiscal-invoice.dto';
import { SeniatIntegrationService } from './seniat-integration.service';
import { AccountingService } from '../accounting/accounting.service';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de facturas fiscales
 */
@Injectable()
export class FiscalInvoicesService {
  private readonly logger = new Logger(FiscalInvoicesService.name);
  
  // ⚡ OPTIMIZACIÓN: Cache para configuración fiscal activa
  private fiscalConfigCache = new Map<string, { result: boolean; timestamp: number }>();
  private readonly FISCAL_CONFIG_CACHE_TTL = 60000; // 60 segundos

  constructor(
    @InjectRepository(FiscalInvoice)
    private fiscalInvoiceRepository: Repository<FiscalInvoice>,
    @InjectRepository(FiscalInvoiceItem)
    private fiscalInvoiceItemRepository: Repository<FiscalInvoiceItem>,
    @InjectRepository(FiscalConfig)
    private fiscalConfigRepository: Repository<FiscalConfig>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private invoiceSeriesService: InvoiceSeriesService,
    private seniatIntegrationService: SeniatIntegrationService,
    private accountingService: AccountingService,
    private dataSource: DataSource,
  ) {}

  /**
   * Valida que una factura pueda ser modificada
   *
   * Según normativa SENIAT, las facturas emitidas NO pueden modificarse.
   * Solo pueden corregirse mediante notas de crédito o débito.
   */
  private validateInvoiceCanBeModified(invoice: FiscalInvoice): void {
    if (invoice.status === 'issued') {
      throw new BadRequestException(
        'Las facturas emitidas no pueden modificarse. ' +
          'Para corregir una factura emitida, debe crear una nota de crédito o débito.',
      );
    }
    if (invoice.status === 'cancelled') {
      throw new BadRequestException(
        'Las facturas canceladas no pueden modificarse',
      );
    }
  }

  /**
   * Genera un número único de factura fiscal
   */
  private async generateInvoiceNumber(
    storeId: string,
    seriesId?: string,
  ): Promise<string> {
    try {
      const invoiceData =
        await this.invoiceSeriesService.generateNextInvoiceNumber(
          storeId,
          seriesId,
        );
      return invoiceData.invoice_full_number;
    } catch (error) {
      // Si no hay series, generar número simple
      const count = await this.fiscalInvoiceRepository.count({
        where: { store_id: storeId },
      });
      return `FAC-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
    }
  }

  /**
   * Genera un número único para nota de crédito (NC-YYYY-NNNNNN)
   */
  private async generateCreditNoteNumber(storeId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.fiscalInvoiceRepository.count({
      where: {
        store_id: storeId,
        invoice_type: 'credit_note',
      },
    });
    return `NC-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  /**
   * Crea una factura fiscal desde una venta
   */
  async createFromSale(
    storeId: string,
    saleId: string,
    userId: string | null,
  ): Promise<FiscalInvoice> {
    const sale = await this.saleRepository.findOne({
      where: { id: saleId, store_id: storeId },
      relations: ['items', 'customer', 'invoiceSeries'],
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    // Verificar si ya existe factura fiscal para esta venta
    const existing = await this.fiscalInvoiceRepository.findOne({
      where: { sale_id: saleId, store_id: storeId },
    });

    if (existing) {
      throw new BadRequestException(
        'Ya existe una factura fiscal para esta venta',
      );
    }

    // Obtener configuración fiscal
    const fiscalConfig = await this.fiscalConfigRepository.findOne({
      where: { store_id: storeId, is_active: true },
    });

    if (!fiscalConfig) {
      throw new BadRequestException(
        'No hay configuración fiscal activa. Configure los datos fiscales primero.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Generar número de factura
      const invoiceNumber = await this.generateInvoiceNumber(
        storeId,
        sale.invoice_series_id || undefined,
      );

      // Obtener información del cliente
      let customerName: string | null = null;
      let customerTaxId: string | null = null;
      const customerAddress: string | null = null;
      let customerPhone: string | null = null;
      const customerEmail: string | null = null;

      if (sale.customer_id) {
        const customer = await this.customerRepository.findOne({
          where: { id: sale.customer_id },
        });
        if (customer) {
          customerName = customer.name;
          customerTaxId = customer.document_id || null;
          customerPhone = customer.phone || null;
        }
      }

      // Calcular totales con impuestos
      const taxRate = fiscalConfig.default_tax_rate;
      const subtotalBs = sale.totals.subtotal_bs - sale.totals.discount_bs;
      const subtotalUsd = sale.totals.subtotal_usd - sale.totals.discount_usd;
      const taxAmountBs = (subtotalBs * taxRate) / 100;
      const taxAmountUsd = (subtotalUsd * taxRate) / 100;
      const totalBs = subtotalBs + taxAmountBs;
      const totalUsd = subtotalUsd + taxAmountUsd;

      // Crear factura fiscal
      const fiscalInvoice = manager.create(FiscalInvoice, {
        id: randomUUID(),
        store_id: storeId,
        sale_id: saleId,
        invoice_number: invoiceNumber,
        invoice_series_id: sale.invoice_series_id || null,
        invoice_type: 'invoice',
        status: 'draft',
        issuer_name: fiscalConfig.business_name,
        issuer_tax_id: fiscalConfig.tax_id,
        issuer_address: fiscalConfig.business_address,
        issuer_phone: fiscalConfig.business_phone,
        issuer_email: fiscalConfig.business_email,
        customer_id: sale.customer_id || null,
        customer_name: customerName,
        customer_tax_id: customerTaxId,
        customer_address: customerAddress,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        subtotal_bs: subtotalBs,
        subtotal_usd: subtotalUsd,
        tax_amount_bs: taxAmountBs,
        tax_amount_usd: taxAmountUsd,
        tax_rate: taxRate,
        discount_bs: sale.totals.discount_bs,
        discount_usd: sale.totals.discount_usd,
        total_bs: totalBs,
        total_usd: totalUsd,
        exchange_rate: sale.exchange_rate,
        currency: sale.currency,
        fiscal_authorization_number: fiscalConfig.fiscal_authorization_number,
        payment_method: sale.payment.method,
        created_by: userId || null,
      });

      const savedInvoice = await manager.save(FiscalInvoice, fiscalInvoice);

      // ⚡ OPTIMIZACIÓN CRÍTICA: Batch query de productos para evitar N+1
      const productIds = sale.items.map(item => item.product_id);
      const products = await manager.find(Product, {
        where: { id: In(productIds) },
      });
      const productMap = new Map<string, Product>();
      for (const product of products) {
        productMap.set(product.id, product);
      }

      // ⚡ OPTIMIZACIÓN CRÍTICA: Crear todos los items y guardarlos en batch
      const items: FiscalInvoiceItem[] = [];
      for (const saleItem of sale.items) {
        const product = productMap.get(saleItem.product_id);

        const itemSubtotalBs =
          saleItem.unit_price_bs * saleItem.qty - (saleItem.discount_bs || 0);
        const itemSubtotalUsd =
          saleItem.unit_price_usd * saleItem.qty - (saleItem.discount_usd || 0);
        const itemTaxBs = (itemSubtotalBs * taxRate) / 100;
        const itemTaxUsd = (itemSubtotalUsd * taxRate) / 100;

        const item = manager.create(FiscalInvoiceItem, {
          id: randomUUID(),
          fiscal_invoice_id: savedInvoice.id,
          product_id: saleItem.product_id,
          variant_id: saleItem.variant_id || null,
          product_name: product?.name || 'Producto',
          product_code: product?.sku || product?.barcode || null,
          quantity: Number(saleItem.qty),
          unit_price_bs: saleItem.unit_price_bs,
          unit_price_usd: saleItem.unit_price_usd,
          discount_bs: saleItem.discount_bs || 0,
          discount_usd: saleItem.discount_usd || 0,
          subtotal_bs: itemSubtotalBs,
          subtotal_usd: itemSubtotalUsd,
          tax_amount_bs: itemTaxBs,
          tax_amount_usd: itemTaxUsd,
          total_bs: itemSubtotalBs + itemTaxBs,
          total_usd: itemSubtotalUsd + itemTaxUsd,
          tax_rate: taxRate,
        });

        items.push(item);
      }

      // ⚡ OPTIMIZACIÓN: Guardar todos los items en batch (una sola query)
      const savedItems = await manager.save(FiscalInvoiceItem, items);
      savedInvoice.items = savedItems;
      return savedInvoice;
    });
  }

  async hasActiveFiscalConfig(storeId: string): Promise<boolean> {
    // ⚡ OPTIMIZACIÓN: Cache para evitar queries repetidas
    const cached = this.fiscalConfigCache.get(storeId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.FISCAL_CONFIG_CACHE_TTL) {
      return cached.result;
    }
    
    const config = await this.fiscalConfigRepository.findOne({
      where: { store_id: storeId, is_active: true },
    });
    const result = !!config;
    
    // Cachear resultado
    this.fiscalConfigCache.set(storeId, { result, timestamp: now });
    
    return result;
  }

  /**
   * Crea una factura fiscal independiente (no desde venta)
   */
  async create(
    storeId: string,
    dto: CreateFiscalInvoiceDto,
    userId: string,
  ): Promise<FiscalInvoice> {
    // Obtener configuración fiscal
    const fiscalConfig = await this.fiscalConfigRepository.findOne({
      where: { store_id: storeId, is_active: true },
    });

    if (!fiscalConfig) {
      throw new BadRequestException(
        'No hay configuración fiscal activa. Configure los datos fiscales primero.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Generar número de factura
      const invoiceNumber = await this.generateInvoiceNumber(
        storeId,
        dto.invoice_series_id || undefined,
      );

      // Obtener información del cliente si se proporciona
      let customerName: string | null = null;
      let customerTaxId: string | null = null;
      let customerAddress: string | null = null;
      let customerPhone: string | null = null;
      let customerEmail: string | null = null;

      if (dto.customer_id) {
        const customer = await this.customerRepository.findOne({
          where: { id: dto.customer_id, store_id: storeId },
        });
        if (customer) {
          customerName = customer.name;
          customerTaxId = customer.document_id || null;
          customerPhone = customer.phone || null;
        }
      } else if (dto.customer_name) {
        customerName = dto.customer_name;
        customerTaxId = dto.customer_tax_id || null;
        customerAddress = dto.customer_address || null;
        customerPhone = dto.customer_phone || null;
        customerEmail = dto.customer_email || null;
      }

      // Calcular totales
      const taxRate = dto.tax_rate ?? fiscalConfig.default_tax_rate;
      let subtotalBs = 0;
      let subtotalUsd = 0;
      let discountBs = 0;
      let discountUsd = 0;

      for (const itemDto of dto.items) {
        const itemSubtotalBs = itemDto.unit_price_bs * itemDto.quantity;
        const itemSubtotalUsd = itemDto.unit_price_usd * itemDto.quantity;
        subtotalBs += itemSubtotalBs - (itemDto.discount_bs || 0);
        subtotalUsd += itemSubtotalUsd - (itemDto.discount_usd || 0);
        discountBs += itemDto.discount_bs || 0;
        discountUsd += itemDto.discount_usd || 0;
      }

      const taxAmountBs = (subtotalBs * taxRate) / 100;
      const taxAmountUsd = (subtotalUsd * taxRate) / 100;
      const totalBs = subtotalBs + taxAmountBs;
      const totalUsd = subtotalUsd + taxAmountUsd;

      // Obtener tasa de cambio (usar la última conocida)
      // Por ahora usar 1, debería obtenerse del ExchangeService
      const exchangeRate = 1;

      // Crear factura fiscal
      const fiscalInvoice = manager.create(FiscalInvoice, {
        id: randomUUID(),
        store_id: storeId,
        sale_id: dto.sale_id || null,
        invoice_number: invoiceNumber,
        invoice_series_id: dto.invoice_series_id || null,
        invoice_type: dto.invoice_type || 'invoice',
        status: 'draft',
        issuer_name: fiscalConfig.business_name,
        issuer_tax_id: fiscalConfig.tax_id,
        issuer_address: fiscalConfig.business_address,
        issuer_phone: fiscalConfig.business_phone,
        issuer_email: fiscalConfig.business_email,
        customer_id: dto.customer_id || null,
        customer_name: customerName,
        customer_tax_id: customerTaxId,
        customer_address: customerAddress,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        subtotal_bs: subtotalBs,
        subtotal_usd: subtotalUsd,
        tax_amount_bs: taxAmountBs,
        tax_amount_usd: taxAmountUsd,
        tax_rate: taxRate,
        discount_bs: discountBs,
        discount_usd: discountUsd,
        total_bs: totalBs,
        total_usd: totalUsd,
        exchange_rate: exchangeRate,
        currency: 'BS', // Por defecto, podría calcularse
        payment_method: dto.payment_method || null,
        note: dto.note || null,
        created_by: userId,
      });

      const savedInvoice = await manager.save(FiscalInvoice, fiscalInvoice);

      // Crear items
      const items: FiscalInvoiceItem[] = [];
      for (const itemDto of dto.items) {
        const product = await this.productRepository.findOne({
          where: { id: itemDto.product_id, store_id: storeId },
        });

        if (!product) {
          throw new NotFoundException(
            `Producto ${itemDto.product_id} no encontrado`,
          );
        }

        const itemSubtotalBs =
          itemDto.unit_price_bs * itemDto.quantity - (itemDto.discount_bs || 0);
        const itemSubtotalUsd =
          itemDto.unit_price_usd * itemDto.quantity -
          (itemDto.discount_usd || 0);
        const itemTaxRate = itemDto.tax_rate ?? taxRate;
        const itemTaxBs = (itemSubtotalBs * itemTaxRate) / 100;
        const itemTaxUsd = (itemSubtotalUsd * itemTaxRate) / 100;

        const item = manager.create(FiscalInvoiceItem, {
          id: randomUUID(),
          fiscal_invoice_id: savedInvoice.id,
          product_id: itemDto.product_id,
          variant_id: itemDto.variant_id || null,
          product_name: product.name,
          product_code: product.sku || product.barcode || null,
          quantity: itemDto.quantity,
          unit_price_bs: itemDto.unit_price_bs,
          unit_price_usd: itemDto.unit_price_usd,
          discount_bs: itemDto.discount_bs || 0,
          discount_usd: itemDto.discount_usd || 0,
          subtotal_bs: itemSubtotalBs,
          subtotal_usd: itemSubtotalUsd,
          tax_amount_bs: itemTaxBs,
          tax_amount_usd: itemTaxUsd,
          total_bs: itemSubtotalBs + itemTaxBs,
          total_usd: itemSubtotalUsd + itemTaxUsd,
          tax_rate: itemTaxRate,
        });

        const savedItem = await manager.save(FiscalInvoiceItem, item);
        items.push(savedItem);
      }

      savedInvoice.items = items;
      return savedInvoice;
    });
  }

  /**
   * Emite una factura fiscal (cambia estado de draft a issued)
   *
   * Transmite la factura al SENIAT y obtiene los códigos fiscales necesarios.
   * Una vez emitida, la factura no puede ser modificada (solo mediante notas de crédito/débito).
   */
  async issue(storeId: string, invoiceId: string): Promise<FiscalInvoice> {
    // ⚡ OPTIMIZACIÓN: No cargar items aquí, generateEntryFromFiscalInvoice los obtiene desde sale_items
    const invoice = await this.fiscalInvoiceRepository.findOne({
      where: { id: invoiceId, store_id: storeId },
    });

    if (!invoice) {
      throw new NotFoundException('Factura fiscal no encontrada');
    }

    if (invoice.status !== 'draft') {
      throw new BadRequestException(
        `Solo se pueden emitir facturas en borrador. Estado actual: ${invoice.status}`,
      );
    }

    // Obtener configuración fiscal
    const fiscalConfig = await this.fiscalConfigRepository.findOne({
      where: { store_id: storeId, is_active: true },
    });

    if (!fiscalConfig) {
      throw new BadRequestException(
        'No hay configuración fiscal activa. Configure los datos fiscales primero.',
      );
    }

    // Validar configuración fiscal
    this.seniatIntegrationService.validateFiscalConfig(fiscalConfig);

    // Transmitir factura al SENIAT y obtener códigos fiscales
    const seniatResponse = await this.seniatIntegrationService.issueInvoice(
      invoice,
      fiscalConfig,
    );

    // Actualizar factura con datos del SENIAT
    invoice.status = 'issued';
    invoice.issued_at = seniatResponse.issued_at;
    invoice.fiscal_number = seniatResponse.fiscal_number;
    invoice.fiscal_control_code = seniatResponse.fiscal_control_code;
    invoice.fiscal_qr_code = seniatResponse.fiscal_qr_code;
    invoice.fiscal_authorization_number = seniatResponse.authorization_number;

    const savedInvoice = await this.fiscalInvoiceRepository.save(invoice);

    // Generar asiento contable automático
    try {
      await this.accountingService.generateEntryFromFiscalInvoice(storeId, savedInvoice);
    } catch (error) {
      // Log error pero no fallar la emisión
      this.logger.error(
        `Error generando asiento contable para factura fiscal ${savedInvoice.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return savedInvoice;
  }

  /**
   * Cancela una factura fiscal
   *
   * IMPORTANTE: Según normativa SENIAT, las facturas emitidas NO pueden cancelarse directamente.
   * Deben corregirse mediante notas de crédito o débito que preserven los datos originales.
   *
   * Este método permite cancelar facturas en borrador. Para facturas emitidas,
   * se debe crear una nota de crédito correspondiente.
   */
  async cancel(storeId: string, invoiceId: string): Promise<FiscalInvoice> {
    const invoice = await this.fiscalInvoiceRepository.findOne({
      where: { id: invoiceId, store_id: storeId },
    });

    if (!invoice) {
      throw new NotFoundException('Factura fiscal no encontrada');
    }

    if (invoice.status === 'cancelled') {
      throw new BadRequestException('La factura ya está cancelada');
    }

    if (invoice.status === 'issued') {
      // Facturas emitidas NO pueden cancelarse directamente según normativa SENIAT
      // Deben corregirse mediante notas de crédito
      throw new BadRequestException(
        'Las facturas emitidas no pueden cancelarse directamente. ' +
          'Debe crear una nota de crédito para anular la factura.',
      );
    }

    invoice.status = 'cancelled';
    invoice.cancelled_at = new Date();

    return this.fiscalInvoiceRepository.save(invoice);
  }

  /**
   * Crea una nota de crédito que anula una factura fiscal emitida.
   *
   * Según normativa SENIAT, las facturas emitidas no pueden cancelarse directamente.
   * Debe crearse una nota de crédito con los mismos datos (cliente, ítems, totales)
   * que la factura original.
   *
   * @param storeId ID de la tienda
   * @param invoiceId ID de la factura a anular
   * @param userId ID del usuario que crea la nota
   * @param reason Motivo opcional (ej. "Venta duplicada por error")
   */
  async createCreditNote(
    storeId: string,
    invoiceId: string,
    userId: string,
    reason?: string,
  ): Promise<FiscalInvoice> {
    const invoice = await this.fiscalInvoiceRepository.findOne({
      where: { id: invoiceId, store_id: storeId },
      relations: ['items', 'invoice_series'],
    });

    if (!invoice) {
      throw new NotFoundException('Factura fiscal no encontrada');
    }

    if (invoice.status !== 'issued') {
      throw new BadRequestException(
        'Solo puede crear nota de crédito para facturas emitidas. ' +
          'La factura actual está en estado "' + invoice.status + '".',
      );
    }

    if (invoice.invoice_type === 'credit_note') {
      throw new BadRequestException(
        'No puede crear una nota de crédito a partir de otra nota de crédito.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const ncNumber = await this.generateCreditNoteNumber(storeId);
      const note = reason
        ? `Nota de crédito que anula factura ${invoice.invoice_number}. Motivo: ${reason}`
        : `Nota de crédito que anula factura ${invoice.invoice_number}.`;

      const creditNote = manager.create(FiscalInvoice, {
        id: randomUUID(),
        store_id: storeId,
        sale_id: invoice.sale_id,
        invoice_number: ncNumber,
        invoice_series_id: invoice.invoice_series_id,
        invoice_type: 'credit_note',
        status: 'draft',
        issuer_name: invoice.issuer_name,
        issuer_tax_id: invoice.issuer_tax_id,
        issuer_address: invoice.issuer_address,
        issuer_phone: invoice.issuer_phone,
        issuer_email: invoice.issuer_email,
        customer_id: invoice.customer_id,
        customer_name: invoice.customer_name,
        customer_tax_id: invoice.customer_tax_id,
        customer_address: invoice.customer_address,
        customer_phone: invoice.customer_phone,
        customer_email: invoice.customer_email,
        subtotal_bs: invoice.subtotal_bs,
        subtotal_usd: invoice.subtotal_usd,
        tax_amount_bs: invoice.tax_amount_bs,
        tax_amount_usd: invoice.tax_amount_usd,
        tax_rate: invoice.tax_rate,
        discount_bs: invoice.discount_bs,
        discount_usd: invoice.discount_usd,
        total_bs: invoice.total_bs,
        total_usd: invoice.total_usd,
        exchange_rate: invoice.exchange_rate,
        currency: invoice.currency,
        payment_method: invoice.payment_method,
        note,
        created_by: userId,
      });

      const saved = await manager.save(FiscalInvoice, creditNote);

      for (const it of invoice.items) {
        const line = manager.create(FiscalInvoiceItem, {
          id: randomUUID(),
          fiscal_invoice_id: saved.id,
          product_id: it.product_id,
          variant_id: it.variant_id,
          product_name: it.product_name,
          product_code: it.product_code,
          quantity: it.quantity,
          unit_price_bs: it.unit_price_bs,
          unit_price_usd: it.unit_price_usd,
          discount_bs: it.discount_bs,
          discount_usd: it.discount_usd,
          subtotal_bs: it.subtotal_bs,
          subtotal_usd: it.subtotal_usd,
          tax_amount_bs: it.tax_amount_bs,
          tax_amount_usd: it.tax_amount_usd,
          total_bs: it.total_bs,
          total_usd: it.total_usd,
          tax_rate: it.tax_rate,
          note: it.note,
        });
        await manager.save(FiscalInvoiceItem, line);
      }

      const withItems = await manager.findOne(FiscalInvoice, {
        where: { id: saved.id },
        relations: ['items', 'sale', 'customer', 'invoice_series'],
      });

      this.logger.log(
        `Nota de crédito ${ncNumber} creada para anular factura ${invoice.invoice_number} (store ${storeId})`,
      );

      return withItems!;
    });
  }

  /**
   * Obtiene todas las facturas fiscales de una tienda
   */
  async findAll(
    storeId: string,
    status?: FiscalInvoiceStatus,
  ): Promise<FiscalInvoice[]> {
    const where: any = { store_id: storeId };
    if (status) {
      where.status = status;
    }

    return this.fiscalInvoiceRepository.find({
      where,
      relations: ['items', 'sale', 'customer'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene una factura fiscal por ID
   */
  async findOne(storeId: string, invoiceId: string): Promise<FiscalInvoice> {
    const invoice = await this.fiscalInvoiceRepository.findOne({
      where: { id: invoiceId, store_id: storeId },
      relations: ['items', 'sale', 'customer', 'invoice_series'],
    });

    if (!invoice) {
      throw new NotFoundException('Factura fiscal no encontrada');
    }

    return invoice;
  }

  /**
   * Obtiene la factura fiscal de una venta (si existe)
   */
  async findBySale(
    storeId: string,
    saleId: string,
  ): Promise<FiscalInvoice | null> {
    return this.fiscalInvoiceRepository.findOne({
      where: { sale_id: saleId, store_id: storeId },
      relations: ['items', 'customer', 'invoice_series'],
    });
  }

  /**
   * Obtiene todas las facturas fiscales asociadas a una venta
   * (puede incluir la factura original y notas de crédito)
   */
  async findAllBySale(
    storeId: string,
    saleId: string,
  ): Promise<FiscalInvoice[]> {
    return this.fiscalInvoiceRepository.find({
      where: { sale_id: saleId, store_id: storeId },
      relations: ['items', 'customer', 'invoice_series'],
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Obtiene estadísticas de facturas fiscales
   */
  async getStatistics(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total_invoices: number;
    issued_invoices: number;
    draft_invoices: number;
    cancelled_invoices: number;
    total_amount_bs: number;
    total_amount_usd: number;
    total_tax_bs: number;
    total_tax_usd: number;
    by_status: Record<string, number>;
  }> {
    const query = this.fiscalInvoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.store_id = :storeId', { storeId });

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.andWhere('invoice.created_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.andWhere('invoice.created_at <= :endDate', { endDate: end });
    }

    const invoices = await query.getMany();

    let total_amount_bs = 0;
    let total_amount_usd = 0;
    let total_tax_bs = 0;
    let total_tax_usd = 0;
    const by_status: Record<string, number> = {};

    for (const invoice of invoices) {
      total_amount_bs += Number(invoice.total_bs);
      total_amount_usd += Number(invoice.total_usd);
      total_tax_bs += Number(invoice.tax_amount_bs);
      total_tax_usd += Number(invoice.tax_amount_usd);

      by_status[invoice.status] = (by_status[invoice.status] || 0) + 1;
    }

    return {
      total_invoices: invoices.length,
      issued_invoices: by_status['issued'] || 0,
      draft_invoices: by_status['draft'] || 0,
      cancelled_invoices: by_status['cancelled'] || 0,
      total_amount_bs,
      total_amount_usd,
      total_tax_bs,
      total_tax_usd,
      by_status,
    };
  }

  /**
   * Endpoint de auditoría para el SENIAT
   *
   * Permite al SENIAT consultar facturas fiscales emitidas para auditorías.
   * Requiere autenticación especial mediante clave de auditoría.
   *
   * @param storeId - ID de la tienda
   * @param queryParams - Parámetros de consulta (fiscal_number, invoice_number, date_range, etc.)
   * @returns Facturas fiscales que coinciden con los criterios
   */
  async audit(
    storeId: string,
    queryParams: {
      fiscal_number?: string;
      invoice_number?: string;
      start_date?: Date;
      end_date?: Date;
      status?: FiscalInvoiceStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    invoices: FiscalInvoice[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const query = this.fiscalInvoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.store_id = :storeId', { storeId })
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.invoice_series', 'invoice_series');

    // Solo facturas emitidas para auditoría
    query.andWhere('invoice.status = :status', { status: 'issued' });

    // Filtros opcionales
    if (queryParams.fiscal_number) {
      query.andWhere('invoice.fiscal_number = :fiscal_number', {
        fiscal_number: queryParams.fiscal_number,
      });
    }

    if (queryParams.invoice_number) {
      query.andWhere('invoice.invoice_number = :invoice_number', {
        invoice_number: queryParams.invoice_number,
      });
    }

    if (queryParams.start_date) {
      const start = new Date(queryParams.start_date);
      start.setHours(0, 0, 0, 0);
      query.andWhere('invoice.issued_at >= :start_date', { start_date: start });
    }

    if (queryParams.end_date) {
      const end = new Date(queryParams.end_date);
      end.setHours(23, 59, 59, 999);
      query.andWhere('invoice.issued_at <= :end_date', { end_date: end });
    }

    // Ordenar por fecha de emisión descendente
    query.orderBy('invoice.issued_at', 'DESC');

    // Paginación
    const limit = queryParams.limit || 100;
    const offset = queryParams.offset || 0;
    query.take(limit);
    query.skip(offset);

    // Obtener total para paginación
    const total = await query.getCount();

    // Obtener facturas
    const invoices = await query.getMany();

    return {
      invoices,
      total,
      limit,
      offset,
    };
  }
}
