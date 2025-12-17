import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountsController } from './discounts.controller';
import { DiscountConfigsService } from './discount-configs.service';
import { DiscountAuthorizationsService } from './discount-authorizations.service';
import { DiscountRulesService } from './discount-rules.service';
import { DiscountConfig } from '../database/entities/discount-config.entity';
import { DiscountAuthorization } from '../database/entities/discount-authorization.entity';
import { Sale } from '../database/entities/sale.entity';

/**
 * Módulo para gestión de descuentos y autorizaciones
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DiscountConfig, DiscountAuthorization, Sale]),
  ],
  controllers: [DiscountsController],
  providers: [
    DiscountConfigsService,
    DiscountAuthorizationsService,
    DiscountRulesService,
  ],
  exports: [DiscountRulesService, DiscountAuthorizationsService],
})
export class DiscountsModule {}
