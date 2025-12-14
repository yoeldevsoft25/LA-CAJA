import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { Product } from '../database/entities/product.entity';
import { Customer } from '../database/entities/customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Customer])],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}

