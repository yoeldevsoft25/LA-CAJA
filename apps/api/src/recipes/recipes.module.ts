import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipesService } from './recipes.service';
import { Product } from '../database/entities/product.entity';
import { RecipeIngredient } from '../database/entities/recipe-ingredient.entity';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { RecipesController } from './recipes.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Product, RecipeIngredient, WarehouseStock]),
        WarehousesModule,
    ],
    controllers: [RecipesController],
    providers: [RecipesService],
    exports: [RecipesService],
})
export class RecipesModule { }
