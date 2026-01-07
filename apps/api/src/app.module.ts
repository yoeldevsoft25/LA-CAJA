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
import { AccountingModule } from './accounting/accounting.module';
import { SecurityModule } from './security/security.module';
import { ConfigModule as SystemConfigModule } from './config/config.module';
import { AdminController } from './admin/admin.controller';
import { AdminApiGuard } from './admin/admin-api.guard';
import { LicenseWatcherService } from './admin/license-watcher.service';
// Importar todas las entidades desde el índice centralizado
// Esto reduce el tamaño del objeto serializado y mejora el rendimiento del bootstrap
import { ALL_ENTITIES, Store, StoreMember, Profile } from './database/entities';
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
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL') || 60000, // 1 minuto
            limit: configService.get<number>('THROTTLE_LIMIT') || 100, // 100 requests por minuto
          },
        ],
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
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';
        
        // Detectar si es un servicio cloud que usa certificados autofirmados
        const isCloudDatabase =
          url.hostname.includes('supabase.co') ||
          url.hostname.includes('render.com') ||
          url.hostname.includes('aws') ||
          url.hostname.includes('azure') ||
          url.hostname.includes('gcp') ||
          configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') === 'false';
        
        // Configuración SSL: en producción, usar SSL pero permitir certificados autofirmados
        // para servicios cloud (Render, Supabase, etc.)
        // Se puede override con DB_SSL_REJECT_UNAUTHORIZED=true para forzar verificación estricta
        const sslRejectUnauthorized =
          configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') === 'true' ||
          (!isCloudDatabase && isProduction);

        return {
          type: 'postgres',
          host: url.hostname,
          port: parseInt(url.port || '5432', 10),
          username: url.username,
          password: decodeURIComponent(url.password), // Decodificar contraseña URL-encoded
          database: url.pathname.slice(1), // Remover el '/' inicial
          // Usar array centralizado de entidades para reducir serialización
          entities: ALL_ENTITIES,
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
          // NOTA: Servicios cloud como Render/Supabase usan certificados autofirmados
          // Se puede forzar verificación estricta con DB_SSL_REJECT_UNAUTHORIZED=true
          ssl: isProduction
            ? {
                rejectUnauthorized: sslRejectUnauthorized,
              }
            : false,
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
    AccountingModule,
    SecurityModule, // ✅ Módulo de seguridad y auditoría
    SystemConfigModule, // ✅ Módulo de validación de configuración
  ],
  controllers: [AppController, AdminController],
  providers: [
    AppService,
    LicenseWatcherService,
    AdminApiGuard, // ✅ Guard administrativo con auditoría
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
