
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
import { Customer } from './database/entities/customer.entity';
import { Debt } from './database/entities/debt.entity';
import { DebtPayment } from './database/entities/debt-payment.entity';
import { Event } from './database/entities/event.entity';
import { LicenseGuard } from './auth/guards/license.guard';

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
        
        return {
          type: 'postgres',
          host: url.hostname,
          port: parseInt(url.port || '5432', 10),
          username: url.username,
          password: decodeURIComponent(url.password), // Decodificar contraseña URL-encoded
          database: url.pathname.slice(1), // Remover el '/' inicial
          entities: [Store, Profile, StoreMember, Product, InventoryMovement, Sale, SaleItem, CashSession, Customer, Debt, DebtPayment, Event],
          synchronize: false, // Usamos migraciones SQL manuales
          logging: configService.get<string>('NODE_ENV') === 'development',
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Store]),
    SyncModule,
    AuthModule,
    ProductsModule,
    InventoryModule,
    SalesModule,
        CashModule,
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
  ],
})
export class AppModule {}
