
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SyncModule } from './sync/sync.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { CashModule } from './cash/cash.module';
import { ShiftsModule } from './shifts/shifts.module';
import { PaymentsModule } from './payments/payments.module';
import { DiscountsModule } from './discounts/discounts.module';
import { FastCheckoutModule } from './fast-checkout/fast-checkout.module';
import { ProductVariantsModule } from './product-variants/product-variants.module';
import { ProductLotsModule } from './product-lots/product-lots.module';
import { ProductSerialsModule } from './product-serials/product-serials.module';
import { InvoiceSeriesModule } from './invoice-series/invoice-series.module';
import { TablesModule } from './tables/tables.module';
import { OrdersModule } from './orders/orders.module';
import { PeripheralsModule } from './peripherals/peripherals.module';
import { PriceListsModule } from './price-lists/price-lists.module';
import { PromotionsModule } from './promotions/promotions.module';
import { CustomersModule } from './customers/customers.module';
import { DebtsModule } from './debts/debts.module';
import { ReportsModule } from './reports/reports.module';
import { BackupModule } from './backup/backup.module';
import { ExchangeModule } from './exchange/exchange.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { TransfersModule } from './transfers/transfers.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { FiscalConfigsModule } from './fiscal-configs/fiscal-configs.module';
import { FiscalInvoicesModule } from './fiscal-invoices/fiscal-invoices.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MLModule } from './ml/ml.module';
import { RealTimeAnalyticsModule } from './realtime-analytics/realtime-analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminController } from './admin/admin.controller';
import { LicenseWatcherService } from './admin/license-watcher.service';
import { Store } from './database/entities/store.entity';
import { Profile } from './database/entities/profile.entity';
import { StoreMember } from './database/entities/store-member.entity';
import { Product } from './database/entities/product.entity';
import { InventoryMovement } from './database/entities/inventory-movement.entity';
import { Sale } from './database/entities/sale.entity';
import { SaleItem } from './database/entities/sale-item.entity';
import { CashSession } from './database/entities/cash-session.entity';
import { Shift } from './database/entities/shift.entity';
import { ShiftCut } from './database/entities/shift-cut.entity';
import { PaymentMethodConfig } from './database/entities/payment-method-config.entity';
import { CashMovement } from './database/entities/cash-movement.entity';
import { DiscountConfig } from './database/entities/discount-config.entity';
import { DiscountAuthorization } from './database/entities/discount-authorization.entity';
import { FastCheckoutConfig } from './database/entities/fast-checkout-config.entity';
import { QuickProduct } from './database/entities/quick-product.entity';
import { ProductVariant } from './database/entities/product-variant.entity';
import { ProductLot } from './database/entities/product-lot.entity';
import { LotMovement } from './database/entities/lot-movement.entity';
import { ProductSerial } from './database/entities/product-serial.entity';
import { InvoiceSeries } from './database/entities/invoice-series.entity';
import { Table } from './database/entities/table.entity';
import { Order } from './database/entities/order.entity';
import { OrderItem } from './database/entities/order-item.entity';
import { OrderPayment } from './database/entities/order-payment.entity';
import { PeripheralConfig } from './database/entities/peripheral-config.entity';
import { PriceList } from './database/entities/price-list.entity';
import { PriceListItem } from './database/entities/price-list-item.entity';
import { Promotion } from './database/entities/promotion.entity';
import { PromotionProduct } from './database/entities/promotion-product.entity';
import { PromotionUsage } from './database/entities/promotion-usage.entity';
import { Customer } from './database/entities/customer.entity';
import { Debt } from './database/entities/debt.entity';
import { DebtPayment } from './database/entities/debt-payment.entity';
import { ExchangeRate } from './database/entities/exchange-rate.entity';
import { Warehouse } from './database/entities/warehouse.entity';
import { WarehouseStock } from './database/entities/warehouse-stock.entity';
import { Transfer } from './database/entities/transfer.entity';
import { TransferItem } from './database/entities/transfer-item.entity';
import { Supplier } from './database/entities/supplier.entity';
import { PurchaseOrder } from './database/entities/purchase-order.entity';
import { PurchaseOrderItem } from './database/entities/purchase-order-item.entity';
import { FiscalInvoice } from './database/entities/fiscal-invoice.entity';
import { FiscalInvoiceItem } from './database/entities/fiscal-invoice-item.entity';
import { FiscalConfig } from './database/entities/fiscal-config.entity';
import { DemandPrediction } from './database/entities/demand-prediction.entity';
import { ProductRecommendation } from './database/entities/product-recommendation.entity';
import { DetectedAnomaly } from './database/entities/detected-anomaly.entity';
import { MLModelMetric } from './database/entities/ml-model-metric.entity';
import { RealTimeMetric } from './database/entities/real-time-metric.entity';
import { AlertThreshold } from './database/entities/alert-threshold.entity';
import { RealTimeAlert } from './database/entities/real-time-alert.entity';
import { SalesHeatmap } from './database/entities/sales-heatmap.entity';
import { ComparativeMetric } from './database/entities/comparative-metric.entity';
import { Notification } from './database/entities/notification.entity';
import { NotificationPreference } from './database/entities/notification-preference.entity';
import { NotificationSubscription } from './database/entities/notification-subscription.entity';
import { NotificationDelivery } from './database/entities/notification-delivery.entity';
import { NotificationBadge } from './database/entities/notification-badge.entity';
import { Event } from './database/entities/event.entity';
import { LicenseGuard } from './auth/guards/license.guard';
import { DatabaseErrorInterceptor } from './common/interceptors/database-error.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      ignoreEnvFile: false, // Intentar leer .env si existe
      // En producción (Render), las variables vienen de process.env automáticamente
    }),
    // Rate limiting global
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [{
          ttl: configService.get<number>('THROTTLE_TTL') || 60000, // 1 minuto
          limit: configService.get<number>('THROTTLE_LIMIT') || 100, // 100 requests por minuto
        }],
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        if (!databaseUrl) {
          throw new Error('DATABASE_URL no está configurada en .env');
        }

        // Parsear la URL manualmente
        const url = new URL(databaseUrl);
        const isProduction = configService.get<string>('NODE_ENV') === 'production';
        
        return {
          type: 'postgres',
          host: url.hostname,
          port: parseInt(url.port || '5432', 10),
          username: url.username,
          password: decodeURIComponent(url.password), // Decodificar contraseña URL-encoded
          database: url.pathname.slice(1), // Remover el '/' inicial
          entities: [Store, Profile, StoreMember, Product, ProductVariant, ProductLot, LotMovement, ProductSerial, InvoiceSeries, Table, Order, OrderItem, OrderPayment, PeripheralConfig, PriceList, PriceListItem, Promotion, PromotionProduct, PromotionUsage, InventoryMovement, Sale, SaleItem, CashSession, Shift, ShiftCut, PaymentMethodConfig, CashMovement, DiscountConfig, DiscountAuthorization, FastCheckoutConfig, QuickProduct, Customer, Debt, DebtPayment, ExchangeRate, Warehouse, WarehouseStock, Transfer, TransferItem, Supplier, PurchaseOrder, PurchaseOrderItem, FiscalInvoice, FiscalInvoiceItem, FiscalConfig, DemandPrediction, ProductRecommendation, DetectedAnomaly, MLModelMetric, RealTimeMetric, AlertThreshold, RealTimeAlert, SalesHeatmap, ComparativeMetric, Notification, NotificationPreference, NotificationSubscription, NotificationDelivery, NotificationBadge, Event],
          synchronize: false, // Usamos migraciones SQL manuales
          logging: configService.get<string>('NODE_ENV') === 'development',
          // Configuración robusta del pool de conexiones para Render/Cloud
          extra: {
            // Pool de conexiones
            max: 20, // Máximo de conexiones en el pool
            min: 2, // Mínimo de conexiones en el pool
            idleTimeoutMillis: 30000, // Cerrar conexiones inactivas después de 30s
            connectionTimeoutMillis: 10000, // Timeout al conectar (10s)
            // Reconexión automática
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000, // Enviar keep-alive cada 10s
          },
          // Configuración de reconexión automática
          retryAttempts: 10, // Reintentar conexión hasta 10 veces
          retryDelay: 3000, // Esperar 3 segundos entre reintentos
          // Timeouts
          connectTimeoutMS: 10000, // 10 segundos para conectar
          // Manejo de errores de conexión
          autoLoadEntities: false, // Ya especificamos entities manualmente
          // SSL para producción (Render/Supabase)
          ssl: isProduction ? {
            rejectUnauthorized: false, // Necesario para Supabase y algunos servicios cloud
          } : false,
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Store, StoreMember, Profile]),
    SyncModule,
    AuthModule,
    ProductsModule,
    InventoryModule,
    SalesModule,
        CashModule,
        ShiftsModule,
        PaymentsModule,
        DiscountsModule,
        FastCheckoutModule,
        ProductVariantsModule,
        ProductLotsModule,
        ProductSerialsModule,
        InvoiceSeriesModule,
        TablesModule,
        OrdersModule,
        PeripheralsModule,
        PriceListsModule,
        PromotionsModule,
        CustomersModule,
        DebtsModule,
        ReportsModule,
        BackupModule,
        ExchangeModule,
        WarehousesModule,
        TransfersModule,
        SuppliersModule,
        PurchaseOrdersModule,
        FiscalConfigsModule,
        FiscalInvoicesModule,
        DashboardModule,
        MLModule,
        RealTimeAnalyticsModule,
        NotificationsModule,
  ],
  controllers: [AppController, AdminController],
  providers: [
    AppService,
    LicenseWatcherService,
    // Aplicar rate limiting globalmente
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: LicenseGuard,
    },
    // Interceptor global para manejar errores de base de datos
    {
      provide: APP_INTERCEPTOR,
      useClass: DatabaseErrorInterceptor,
    },
  ],
})
export class AppModule {}
