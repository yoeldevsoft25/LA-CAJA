import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';
import { QRCodesService } from './qr-codes.service';
import { Table } from '../database/entities/table.entity';
import { QRCode } from '../database/entities/qr-code.entity';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Módulo para gestión de mesas y códigos QR
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Table, QRCode]),
    ConfigModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [TablesController],
  providers: [TablesService, QRCodesService],
  exports: [TablesService, QRCodesService],
})
export class TablesModule {}
