import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { FiscalInvoicesService } from '../../fiscal-invoices/fiscal-invoices.service';
import { AccountingService } from '../../accounting/accounting.service';
import { Sale } from '../../database/entities/sale.entity';

export interface PostProcessSaleJob {
  storeId: string;
  saleId: string;
  userId?: string;
  generateFiscalInvoice?: boolean; // Si true, genera factura fiscal
}

/**
 * Queue Processor para tareas post-venta
 * Procesa facturas fiscales, asientos contables y otras tareas
 * que no son críticas para la respuesta inmediata al cliente
 */
@Processor('sales-post-processing', {
  concurrency: 20, // 🚀 GOD MODE: High background throughput
  limiter: {
    max: 100, // Procesar hasta 100 jobs por segundo (Ryzen Power)
    duration: 1000,
  },
})
export class SalesPostProcessingQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(SalesPostProcessingQueueProcessor.name);

  constructor(
    private fiscalInvoicesService: FiscalInvoicesService,
    private accountingService: AccountingService,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
  ) {
    super();
  }

  async process(job: Job<PostProcessSaleJob>): Promise<void> {
    const { storeId, saleId, userId } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `Procesando tareas post-venta para venta ${saleId} (store: ${storeId})`,
    );

    try {
      await job.updateProgress(10);

      // 1. Procesar factura fiscal si está configurado Y el usuario lo solicitó
      let fiscalInvoiceIssued = false;
      let fiscalInvoiceFound = false;

      try {
        const { generateFiscalInvoice = false } = job.data;
        const hasFiscalConfig =
          await this.fiscalInvoicesService.hasActiveFiscalConfig(storeId);

        // Solo generar factura fiscal si:
        // 1. El usuario lo solicitó (generateFiscalInvoice = true)
        // 2. Y existe una configuración fiscal activa
        if (generateFiscalInvoice && hasFiscalConfig) {
          await job.updateProgress(30);

          const existingInvoice = await this.fiscalInvoicesService.findBySale(
            storeId,
            saleId,
          );

          if (existingInvoice) {
            fiscalInvoiceFound = true;
            if (existingInvoice.status === 'draft') {
              const issuedInvoice = await this.fiscalInvoicesService.issue(
                storeId,
                existingInvoice.id,
              );
              fiscalInvoiceIssued = issuedInvoice.status === 'issued';
              this.logger.log(
                `✅ Factura fiscal emitida para venta ${saleId}: ${issuedInvoice.invoice_number}`,
              );
            } else {
              fiscalInvoiceIssued = existingInvoice.status === 'issued';
              this.logger.log(
                `ℹ️ Factura fiscal ya existía para venta ${saleId}: ${existingInvoice.invoice_number}`,
              );
            }
          } else {
            await job.updateProgress(50);
            const createdInvoice =
              await this.fiscalInvoicesService.createFromSale(
                storeId,
                saleId,
                userId || null,
              );
            const issuedInvoice = await this.fiscalInvoicesService.issue(
              storeId,
              createdInvoice.id,
            );
            fiscalInvoiceIssued = issuedInvoice.status === 'issued';
            fiscalInvoiceFound = true;
            this.logger.log(
              `✅ Factura fiscal creada y emitida para venta ${saleId}: ${issuedInvoice.invoice_number}`,
            );
          }
        } else if (!generateFiscalInvoice) {
          this.logger.log(
            `ℹ️ Factura fiscal no solicitada para venta ${saleId}`,
          );
        } else if (!hasFiscalConfig) {
          this.logger.log(
            `⚠️ No hay configuración fiscal activa para tienda ${storeId}`,
          );
        }
      } catch (error) {
        // Log error pero no fallar el job completo
        this.logger.error(
          `Error procesando factura fiscal para venta ${saleId}:`,
          error instanceof Error ? error.stack : String(error),
        );
      }

      await job.updateProgress(70);

      // 2. Procesar/Verificar asiento contable
      // Asegurar que exista un asiento contable, ya sea de la factura fiscal o de la venta
      if (fiscalInvoiceIssued || fiscalInvoiceFound) {
        try {
          const invoice = await this.fiscalInvoicesService.findBySale(
            storeId,
            saleId,
          );
          if (invoice && invoice.status === 'issued') {
            await this.accountingService.generateEntryFromFiscalInvoice(
              storeId,
              invoice,
            );
            this.logger.log(
              `✅ Asiento contable verificado/generado para factura fiscal ${invoice.invoice_number}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error generando asiento contable para factura fiscal de venta ${saleId}:`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      } else {
        try {
          // Obtener la venta completa para el asiento contable
          const sale = await this.saleRepository.findOne({
            where: { id: saleId, store_id: storeId },
            relations: ['items', 'items.product', 'customer'],
          });

          if (!sale) {
            this.logger.warn(
              `Venta ${saleId} no encontrada para generar asiento contable`,
            );
          } else {
            await this.accountingService.generateEntryFromSale(storeId, sale);

            this.logger.log(
              `✅ Asiento contable generado para venta ${saleId}`,
            );
          }
        } catch (error) {
          // Log error pero no fallar el job completo
          this.logger.error(
            `Error generando asiento contable para venta ${saleId}:`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      await job.updateProgress(100);

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Tareas post-venta completadas para venta ${saleId} en ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Error en tareas post-venta para venta ${saleId} después de ${duration}ms:`,
        error instanceof Error ? error.stack : String(error),
      );

      // Re-lanzar el error para que BullMQ maneje el retry
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(
      `Job de post-procesamiento ${job.name} (${job.id}) completado exitosamente`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job de post-procesamiento ${job.name} (${job.id}) falló después de ${job.attemptsMade} intentos:`,
      error.message,
    );
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(
      `Job de post-procesamiento ${job.name} (${job.id}) progreso: ${progress}%`,
    );
  }
}
