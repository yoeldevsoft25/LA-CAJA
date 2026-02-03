import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('recipes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @ApiOperation({ summary: 'Obtener ingredientes de un plato' })
  @Get(':productId/ingredients')
  async getIngredients(@Param('productId') productId: string) {
    return this.recipesService.getIngredients(productId);
  }

  @ApiOperation({ summary: 'Obtener disponibilidad de un plato' })
  @Get(':productId/availability')
  async getAvailability(
    @Param('productId') productId: string,
    @Query('warehouse_id') warehouseId: string | undefined,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.recipesService.calculateAvailability(
      storeId,
      productId,
      warehouseId,
    );
  }

  @ApiOperation({ summary: 'Obtener costo calculado de un plato' })
  @Get(':productId/cost')
  async getCost(@Param('productId') productId: string) {
    return this.recipesService.calculateRecipeCost(productId);
  }
}
