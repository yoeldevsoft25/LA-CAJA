import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product } from '../database/entities/product.entity';
import { RecipeIngredient } from '../database/entities/recipe-ingredient.entity';
import { ExchangeModule } from '../exchange/exchange.module';
import { LicensesModule } from '../licenses/licenses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, RecipeIngredient]),
    ExchangeModule,
    LicensesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
