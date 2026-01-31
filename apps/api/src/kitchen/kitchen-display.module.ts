import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenDisplayController } from './kitchen-display.controller';
import { KitchenPublicController } from './kitchen-public.controller';
import { KitchenDisplayService } from './kitchen-display.service';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Table } from '../database/entities/table.entity';
import { Product } from '../database/entities/product.entity';
import { Store } from '../database/entities/store.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecipesModule } from '../recipes/recipes.module';

/**
 * Módulo para Kitchen Display System (KDS)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Table, Product, Store]),
    forwardRef(() => NotificationsModule),
    RecipesModule,
  ],
  controllers: [KitchenDisplayController, KitchenPublicController],
  providers: [KitchenDisplayService],
  exports: [KitchenDisplayService],
})
export class KitchenDisplayModule { }
