import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { Promotion } from '../database/entities/promotion.entity';
import { PromotionProduct } from '../database/entities/promotion-product.entity';
import { PromotionUsage } from '../database/entities/promotion-usage.entity';
import { Product } from '../database/entities/product.entity';

/**
 * Módulo para gestión de promociones
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Promotion,
      PromotionProduct,
      PromotionUsage,
      Product,
    ]),
  ],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
