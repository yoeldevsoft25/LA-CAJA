import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductVariantsService } from './product-variants.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestión de variantes de productos
 */
@Controller('product-variants')
@UseGuards(JwtAuthGuard)
export class ProductVariantsController {
  constructor(private readonly variantsService: ProductVariantsService) {}

  /**
   * Crea una nueva variante de producto
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createVariant(
    @Body() dto: CreateProductVariantDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.variantsService.createVariant(storeId, dto);
  }

  /**
   * Actualiza una variante existente
   */
  @Put(':id')
  async updateVariant(
    @Param('id') id: string,
    @Body() dto: Partial<CreateProductVariantDto>,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.variantsService.updateVariant(storeId, id, dto);
  }

  /**
   * Obtiene todas las variantes de un producto
   */
  @Get('product/:productId')
  async getVariantsByProduct(
    @Param('productId') productId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.variantsService.getVariantsByProduct(storeId, productId);
  }

  /**
   * Obtiene variantes agrupadas por tipo
   */
  @Get('product/:productId/grouped')
  async getVariantsGroupedByType(
    @Param('productId') productId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.variantsService.getVariantsGroupedByType(storeId, productId);
  }

  /**
   * Obtiene una variante por su ID
   */
  @Get(':id')
  async getVariantById(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.variantsService.getVariantById(storeId, id);
  }

  /**
   * Obtiene una variante por código de barras
   */
  @Get('barcode/:barcode')
  async getVariantByBarcode(
    @Param('barcode') barcode: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.variantsService.getVariantByBarcode(storeId, barcode);
  }

  /**
   * Obtiene el stock actual de una variante
   */
  @Get(':id/stock')
  async getVariantStock(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    const stock = await this.variantsService.getVariantStock(storeId, id);
    return { variant_id: id, stock };
  }

  /**
   * Elimina una variante (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVariant(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    await this.variantsService.deleteVariant(storeId, id);
  }
}
