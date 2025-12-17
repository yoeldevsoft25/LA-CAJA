import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FastCheckoutController } from './fast-checkout.controller';
import { FastCheckoutConfigsService } from './fast-checkout-configs.service';
import { QuickProductsService } from './quick-products.service';
import { FastCheckoutRulesService } from './fast-checkout-rules.service';
import { FastCheckoutConfig } from '../database/entities/fast-checkout-config.entity';
import { QuickProduct } from '../database/entities/quick-product.entity';
import { Product } from '../database/entities/product.entity';

/**
 * Módulo para gestión de modo caja rápida
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FastCheckoutConfig, QuickProduct, Product]),
  ],
  controllers: [FastCheckoutController],
  providers: [
    FastCheckoutConfigsService,
    QuickProductsService,
    FastCheckoutRulesService,
  ],
  exports: [FastCheckoutRulesService],
})
export class FastCheckoutModule {}
