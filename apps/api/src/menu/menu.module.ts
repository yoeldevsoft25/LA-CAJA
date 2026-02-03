import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { Product } from '../database/entities/product.entity';
import { QRCode } from '../database/entities/qr-code.entity';
import { Table } from '../database/entities/table.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { PublicOrdersService } from '../orders/public-orders.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecipesModule } from '../recipes/recipes.module';

/**
 * Módulo para menú público (acceso desde QR codes)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      QRCode,
      Table,
      InventoryMovement,
      Order,
      OrderItem,
    ]),
    forwardRef(() => NotificationsModule),
    RecipesModule,
  ],
  controllers: [MenuController],
  providers: [MenuService, PublicOrdersService],
  exports: [MenuService],
})
export class MenuModule {}
