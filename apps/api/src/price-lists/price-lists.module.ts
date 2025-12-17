import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceListsController } from './price-lists.controller';
import { PriceListsService } from './price-lists.service';
import { PriceList } from '../database/entities/price-list.entity';
import { PriceListItem } from '../database/entities/price-list-item.entity';
import { Product } from '../database/entities/product.entity';

/**
 * Módulo para gestión de listas de precio
 */
@Module({
  imports: [TypeOrmModule.forFeature([PriceList, PriceListItem, Product])],
  controllers: [PriceListsController],
  providers: [PriceListsService],
  exports: [PriceListsService],
})
export class PriceListsModule {}
