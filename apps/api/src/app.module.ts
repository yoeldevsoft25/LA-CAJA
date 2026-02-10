import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import Redis from 'ioredis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbRepairService } from './database/repair-db.service';
import { SyncModule } from './sync/sync.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { InventoryEscrowModule } from './inventory/escrow/inventory-escrow.module';
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
import { SupplierPriceListsModule } from './supplier-price-lists/supplier-price-lists.module';
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
import { SetupModule } from './setup/setup.module';
import { LicensesModule } from './licenses/licenses.module';
import { MenuModule } from './menu/menu.module';
import { KitchenDisplayModule } from './kitchen/kitchen-display.module';
import { ReservationsModule } from './reservations/reservations.module';
import { RecipesModule } from './recipes/recipes.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { AdminController } from './admin/admin.controller';
import { AdminApiGuard } from './admin/admin-api.guard';
import { LicenseWatcherService } from './admin/license-watcher.service';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ObservabilityModule } from './observability/observability.module';
import { RedisCacheModule } from './common/cache/redis-cache.module';
import { RedisModule, REDIS_CLIENT, REDIS_SUBSCRIBER } from './common/redis/redis.module';
// Nota: LicenseWatcherService necesita NotificationsGateway, que está en NotificationsModule
// Importar todas las entidades desde el índice centralizado
// Esto reduce el tamaño del objeto serializado y mejora el rendimiento del bootstrap
import {
  ALL_ENTITIES,
  Store,
  StoreMember,
  Profile,
  LicenseUsage,
} from './database/entities';
import { LicenseInterceptor } from './auth/interceptors/license.interceptor';
import { RolesGuard } from './auth/guards/roles.guard';
import { DatabaseErrorInterceptor } from './common/interceptors/database-error.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StoreIdValidationInterceptor } from './common/interceptors/store-id-validation.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { BullModule } from '@nestjs/bullmq';
import {
  isLocalDbHost,
  resolveDbConnection,
} from './database/db-connection.config';

const ENV_FILE_CANDIDATES = [
  resolve(process.cwd(), 'apps/api/.env.local'),
  resolve(process.cwd(), 'apps/api/.env'),
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env'),
].filter((candidate, index, arr) => arr.indexOf(candidate) === index);

const IS_PRODUCTION_RUNTIME = process.env.NODE_ENV === 'production';
const ENV_FILE_PATHS = IS_PRODUCTION_RUNTIME
  ? []
  : ENV_FILE_CANDIDATES.filter((candidate) => existsSync(candidate));

const QUEUES_ENABLED =
  process.env.QUEUES_ENABLED?.toLowerCase() !== 'false' &&
  process.env.QUEUES_DISABLED?.toLowerCase() !== 'true';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Robust path resolution for workspace runs on Windows/Mac/Linux.
      // If launched from repo root, prefer apps/api/.env.
      // If launched from apps/api, .env is still discovered.
      envFilePath: ENV_FILE_PATHS.length > 0 ? ENV_FILE_PATHS : undefined,
      // In production (Render), rely on process.env only.
      ignoreEnvFile: IS_PRODUCTION_RUNTIME,
      // En producción (Render), las variables vienen de process.env automáticamente
    }),
    RedisCacheModule,
    ScheduleModule.forRoot(),
    // ⚡ CRÍTICO: Conexión Redis compartida globalmente para BullMQ
    // Esto evita crear múltiples conexiones Redis (cada una consume un cliente)
    // El plan gratuito de Redis Cloud tiene límite de ~10-30 conexiones
    ...(QUEUES_ENABLED
      ? [
        BullModule.forRootAsync({
          imports: [ConfigModule, RedisModule],
          inject: [ConfigService, REDIS_CLIENT, REDIS_SUBSCRIBER],
          useFactory: async (
            configService: ConfigService,
            sharedClient: Redis,
            sharedSubscriber: Redis,
          ) => {
            const redisUrl = configService.get<string>('REDIS_URL');
            let connectionOpts: any = {};

            if (redisUrl) {
              connectionOpts = {
                url: redisUrl,
                maxRetriesPerRequest: null,
                enableOfflineQueue: true,
                connectTimeout: 5000,
              };
            } else {
              connectionOpts = {
                host: configService.get<string>('REDIS_HOST') || 'localhost',
                port: configService.get<number>('REDIS_PORT') || 6379,
                password: configService.get<string>('REDIS_PASSWORD'),
                maxRetriesPerRequest: null,
                enableOfflineQueue: true,
                connectTimeout: 5000,
              };
            }

            return {
              connection: connectionOpts,
              createClient: (type) => {
                switch (type) {
                  case 'client':
                    return sharedClient;
                  case 'subscriber':
                    return sharedSubscriber;
                  case 'bclient':
                    // bclient (blocking client) NO puede ser compartido entre workers
                    return sharedClient.duplicate();
                  default:
                    return sharedClient.duplicate();
                }
              },
              // Opciones por defecto para jobs
              defaultJobOptions: {
                removeOnComplete: 100, // Mantener solo los últimos 100 trabajos completados
                removeOnFail: 200, // Mantener los últimos 200 fallidos para debugging
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 1000,
                },
              },
            };
          },
        }),
      ]
      : []),
    // Rate limiting global
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL') || 60, // segundos
            limit: configService.get<number>('THROTTLE_LIMIT') || 100, // 100 requests por minuto
          },
        ],
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const resolvedDb = resolveDbConnection((key) =>
          configService.get<string>(key),
        );
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';
        const isDevelopment = !isProduction;

        // Detectar si es un servicio cloud que usa certificados autofirmados
        const isCloudDatabase =
          resolvedDb.host.includes('supabase.co') ||
          resolvedDb.host.includes('pooler.supabase.com') ||
          resolvedDb.host.includes('render.com') ||
          resolvedDb.host.includes('aws') ||
          resolvedDb.host.includes('azure') ||
          resolvedDb.host.includes('gcp') ||
          (configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') ===
            'false' &&
            !isLocalDbHost(resolvedDb.host));

        // Configuración SSL: servicios cloud (Supabase, Render) requieren SSL incluso en desarrollo
        // En produccion, SIEMPRE rechazar certificados no autorizados
        // En desarrollo, se puede usar DB_SSL_REJECT_UNAUTHORIZED=true para forzar verificacion
        const sslRejectUnauthorizedEnv = configService.get<string>(
          'DB_SSL_REJECT_UNAUTHORIZED',
        );
        const allowInsecureDbSsl =
          configService.get<string>('ALLOW_INSECURE_DB_SSL') === 'true';
        const requestedRejectUnauthorized =
          sslRejectUnauthorizedEnv === 'true'
            ? true
            : sslRejectUnauthorizedEnv === 'false'
              ? false
              : undefined;
        // Para servicios cloud en desarrollo, por defecto aceptar certificados autofirmados
        // a menos que se especifique explícitamente DB_SSL_REJECT_UNAUTHORIZED=true
        const sslRejectUnauthorized = isProduction
          ? !(requestedRejectUnauthorized === false && allowInsecureDbSsl)
          : requestedRejectUnauthorized === true
            ? true
            : isCloudDatabase
              ? false // Aceptar certificados autofirmados en cloud databases en desarrollo
              : requestedRejectUnauthorized !== false;

        const sslCaEnv = configService.get<string>('DB_SSL_CA');
        const sslCaFile = configService.get<string>('DB_SSL_CA_FILE');
        const sslCa = sslCaEnv
          ? sslCaEnv.replace(/\\n/g, '\n')
          : sslCaFile
            ? readFileSync(sslCaFile, 'utf8')
            : undefined;

        // Timeouts configurables: más largos en desarrollo local (útil para VPN)
        const connectionTimeoutEnv = configService.get<number>(
          'DB_CONNECTION_TIMEOUT',
        );
        const connectionTimeout =
          connectionTimeoutEnv || (isDevelopment ? 30000 : 10000); // 30s en dev, 10s en prod

        // Pool configurable: más conservador en desarrollo local
        const poolMax =
          configService.get<number>('DB_POOL_MAX') || (isDevelopment ? 5 : 20);
        const poolMin =
          configService.get<number>('DB_POOL_MIN') || (isDevelopment ? 1 : 2);

        return {
          type: 'postgres',
          host: resolvedDb.host,
          port: resolvedDb.port,
          username: resolvedDb.username,
          password: resolvedDb.password,
          database: resolvedDb.database,
          // Usar array centralizado de entidades para reducir serialización
          entities: ALL_ENTITIES,
          synchronize: false, // Usamos migraciones SQL manuales
          logging: configService.get<string>('NODE_ENV') === 'development' || configService.get<string>('DB_LOGGING') === 'true',
          // Configuración robusta del pool de conexiones para Render/Cloud
          extra: {
            // Pool de conexiones (más conservador en desarrollo local con VPN)
            max: poolMax,
            min: poolMin,
            idleTimeoutMillis: 30000, // Cerrar conexiones inactivas después de 30s
            connectionTimeoutMillis: connectionTimeout, // Timeout configurable (30s en dev con VPN)
            // Reconexión automática
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000, // Enviar keep-alive cada 10s
          },
          // Configuración de reconexión automática
          retryAttempts: 10, // Reintentar conexión hasta 10 veces
          retryDelay: 3000, // Esperar 3 segundos entre reintentos
          // Timeouts
          connectTimeoutMS: connectionTimeout, // Timeout configurable
          // Manejo de errores de conexión
          autoLoadEntities: false, // Ya especificamos entities manualmente
          // SSL: servicios cloud (Supabase, Render) requieren SSL incluso en desarrollo
          // NOTA: Supabase pooler requiere SSL siempre, incluso en desarrollo
          ssl:
            (isCloudDatabase || isProduction) && !isLocalDbHost(resolvedDb.host)
              ? {
                rejectUnauthorized: sslRejectUnauthorized,
                ...(sslCa ? { ca: sslCa } : {}),
              }
              : false,
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Store, StoreMember, Profile, LicenseUsage]),
    SyncModule,
    AuthModule,
    ProductsModule,
    InventoryModule,
    InventoryEscrowModule,
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
    SupplierPriceListsModule,
    PurchaseOrdersModule,
    FiscalConfigsModule,
    FiscalInvoicesModule,
    FiscalModule, // ✅ Módulo de secuencias fiscales
    DashboardModule,
    MLModule,
    RealTimeAnalyticsModule,
    NotificationsModule,
    WhatsAppModule,
    AccountingModule,
    SecurityModule, // ✅ Módulo de seguridad y auditoría
    SystemConfigModule, // ✅ Módulo de validación de configuración
    SetupModule, // ✅ Módulo de setup automático y onboarding
    LicensesModule, // ✅ Módulo de pagos de licencias
    MenuModule, // ✅ Módulo de menú público QR
    KitchenDisplayModule, // ✅ Módulo de Kitchen Display System
    ReservationsModule, // ✅ Módulo de reservas
    RecipesModule, // ✅ Módulo de recetas y manufactura
    HealthModule, // ✅ Módulo de health checks
    MetricsModule, // ✅ Módulo de métricas Prometheus
    ObservabilityModule, // ✅ Módulo de observabilidad completo
  ],
  controllers: [AppController, AdminController],
  providers: [
    AppService,
    DbRepairService, // ⚠️ Auto-Fix Service
    LicenseWatcherService,
    AdminApiGuard, // ✅ Guard administrativo con auditoría
    // Aplicar rate limiting globalmente
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // RolesGuard removido de guards globales - debe ejecutarse DESPUÉS de JwtAuthGuard
    // Se aplica explícitamente en controladores que lo requieren: @UseGuards(JwtAuthGuard, RolesGuard)
    // Interceptor global para manejar errores de base de datos
    {
      provide: APP_INTERCEPTOR,
      useClass: DatabaseErrorInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: StoreIdValidationInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LicenseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule { }
