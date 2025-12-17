import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentMethodConfigsService } from './payment-method-configs.service';
import { CashMovementsService } from './cash-movements.service';
import { PaymentRulesService } from './payment-rules.service';
import { PaymentMethodConfig } from '../database/entities/payment-method-config.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';

/**
 * Módulo para gestión de métodos de pago y movimientos de efectivo
 */
@Module({
  imports: [TypeOrmModule.forFeature([PaymentMethodConfig, CashMovement])],
  controllers: [PaymentsController],
  providers: [
    PaymentMethodConfigsService,
    CashMovementsService,
    PaymentRulesService,
  ],
  exports: [PaymentRulesService, CashMovementsService],
})
export class PaymentsModule {}
