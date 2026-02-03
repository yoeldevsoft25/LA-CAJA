import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentMethodConfigsService } from './payment-method-configs.service';
import { CashMovementsService } from './cash-movements.service';
import { PaymentRulesService } from './payment-rules.service';
import { PaymentMethodConfig } from '../database/entities/payment-method-config.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';
import { CashSession } from '../database/entities/cash-session.entity';

/**
 * Módulo para gestión de métodos de pago y movimientos de efectivo
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentMethodConfig, CashMovement, CashSession]),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentMethodConfigsService,
    CashMovementsService,
    PaymentRulesService,
  ],
  exports: [
    PaymentMethodConfigsService,
    PaymentRulesService,
    CashMovementsService,
  ],
})
export class PaymentsModule {}
