import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MLService } from './ml.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PredictDemandDto } from './dto/predict-demand.dto';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { DetectAnomaliesDto } from './dto/detect-anomalies.dto';
import { ResolveAnomalyDto } from './dto/resolve-anomaly.dto';

@Controller('ml')
@UseGuards(JwtAuthGuard)
export class MLController {
  constructor(private readonly mlService: MLService) {}

  /**
   * Predice la demanda de un producto
   * POST /ml/predict-demand
   */
  @Post('predict-demand')
  async predictDemand(@Body() dto: PredictDemandDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return await this.mlService.predictDemand(storeId, dto);
  }

  /**
   * Obtiene recomendaciones de productos
   * GET /ml/recommendations
   */
  @Get('recommendations')
  async getRecommendations(
    @Query() dto: GetRecommendationsDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return await this.mlService.getRecommendations(storeId, dto);
  }

  /**
   * Detecta anomalías en ventas, inventario, etc.
   * GET /ml/anomalies
   */
  @Get('anomalies')
  async detectAnomalies(@Query() dto: DetectAnomaliesDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return await this.mlService.detectAnomalies(storeId, dto);
  }

  /**
   * Resuelve una anomalía detectada
   * PUT /ml/anomalies/:id/resolve
   */
  @Put('anomalies/:id/resolve')
  async resolveAnomaly(
    @Param('id') id: string,
    @Body() dto: ResolveAnomalyDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    return await this.mlService.resolveAnomaly(
      storeId,
      id,
      userId,
      dto.resolution_note,
    );
  }
}
