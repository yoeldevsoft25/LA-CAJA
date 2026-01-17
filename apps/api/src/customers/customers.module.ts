import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { Customer } from '../database/entities/customer.entity';
import { Sale } from '../database/entities/sale.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Sale])],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
