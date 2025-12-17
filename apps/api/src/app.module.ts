
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
import { CustomersModule } from './customers/customers.module';
import { DebtsModule } from './debts/debts.module';
import { ReportsModule } from './reports/reports.module';
import { BackupModule } from './backup/backup.module';
import { ExchangeModule } from './exchange/exchange.module';
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
import { Customer } from './database/entities/customer.entity';
import { Debt } from './database/entities/debt.entity';
import { DebtPayment } from './database/entities/debt-payment.entity';
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
          entities: [Store, Profile, StoreMember, Product, ProductVariant, ProductLot, LotMovement, ProductSerial, InvoiceSeries, Table, Order, OrderItem, OrderPayment, InventoryMovement, Sale, SaleItem, CashSession, Shift, ShiftCut, PaymentMethodConfig, CashMovement, DiscountConfig, DiscountAuthorization, FastCheckoutConfig, QuickProduct, Customer, Debt, DebtPayment, Event],
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
        CustomersModule,
        DebtsModule,
        ReportsModule,
        BackupModule,
    ExchangeModule,
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
