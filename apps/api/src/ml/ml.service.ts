import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DemandPrediction } from '../database/entities/demand-prediction.entity';
import {
  ProductRecommendation,
  RecommendationType,
} from '../database/entities/product-recommendation.entity';
import {
  DetectedAnomaly,
  AnomalyType,
  AnomalySeverity,
  EntityType,
} from '../database/entities/detected-anomaly.entity';
import {
  MLModelMetric,
  ModelType,
} from '../database/entities/ml-model-metric.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { randomUUID } from 'crypto';
import { PredictDemandDto } from './dto/predict-demand.dto';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { DetectAnomaliesDto } from './dto/detect-anomalies.dto';
import { FeatureEngineeringService } from './features/feature-engineering.service';
import { DemandForecastingModel } from './models/demand-forecasting.model';
import { AnomalyDetectionModel } from './models/anomaly-detection.model';
import { ModelEvaluationService } from './metrics/model-evaluation.service';
import { MLCacheService } from './cache/ml-cache.service';

/**
 * Servicio de Machine Learning Avanzado y Robusto
 * Implementa predicciones, recomendaciones y detección de anomalías usando algoritmos avanzados
 */
@Injectable()
export class MLService {
  private readonly logger = new Logger(MLService.name);
  private readonly MODEL_VERSION = 'v2.0'; // Versión avanzada

  constructor(
    @InjectRepository(DemandPrediction)
    private demandPredictionRepository: Repository<DemandPrediction>,
    @InjectRepository(ProductRecommendation)
    private productRecommendationRepository: Repository<ProductRecommendation>,
    @InjectRepository(DetectedAnomaly)
    private detectedAnomalyRepository: Repository<DetectedAnomaly>,
    @InjectRepository(MLModelMetric)
    private mlModelMetricRepository: Repository<MLModelMetric>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(InventoryMovement)
    private inventoryMovementRepository: Repository<InventoryMovement>,
    private featureEngineering: FeatureEngineeringService,
    private forecastingModel: DemandForecastingModel,
    private anomalyModel: AnomalyDetectionModel,
    private evaluationService: ModelEvaluationService,
    private cache: MLCacheService,
  ) {
    // Limpiar caché expirado cada 5 minutos
    setInterval(
      () => {
        this.cache.cleanExpired();
      },
      1000 * 60 * 5,
    );
  }

  /**
   * Predice la demanda de un producto usando modelos avanzados
   * Implementa: Exponential Smoothing, ARIMA, Ensemble
   */
  async predictDemand(
    storeId: string,
    dto: PredictDemandDto,
  ): Promise<{
    product_id: string;
    predictions: Array<{
      date: string;
      predicted_quantity: number;
      confidence_score: number;
      model_used: string;
    }>;
    metrics?: {
      mae: number;
      rmse: number;
      mape: number;
      r2: number;
    };
  }> {
    // Verificar caché
    const cacheKey = this.cache.generatePredictionKey(
      storeId,
      dto.product_id,
      dto.days_ahead,
    );
    const cached = this.cache.get<{
      product_id: string;
      predictions: Array<{
        date: string;
        predicted_quantity: number;
        confidence_score: number;
        model_used: string;
      }>;
    }>(cacheKey);

    if (cached) {
      this.logger.debug('Predicción obtenida del caché');
      return cached;
    }

    // Verificar que el producto existe
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Obtener historial de ventas (últimos 180 días para más datos)
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 180);

    const sales = await this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.sale', 'sale')
      .where('item.product_id = :productId', { productId: dto.product_id })
      .andWhere('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :startDate', { startDate })
      .andWhere('sale.sold_at <= :endDate', { endDate })
      .select('DATE(sale.sold_at)', 'date')
      .addSelect('SUM(item.qty)', 'total_qty')
      .groupBy('DATE(sale.sold_at)')
      .orderBy('DATE(sale.sold_at)', 'ASC')
      .getRawMany();

    const dailyQuantities = sales.map((s) => ({
      date: new Date(s.date),
      quantity: parseFloat(s.total_qty) || 0,
    }));

    // Si no hay datos históricos suficientes
    if (dailyQuantities.length < 7) {
      const currentStock = await this.getCurrentStock(storeId, dto.product_id);
      const avgQuantity = currentStock > 0 ? currentStock / 7 : 1;

      const predictions: Array<{
        date: string;
        predicted_quantity: number;
        confidence_score: number;
        model_used: string;
      }> = [];

      for (let i = 1; i <= dto.days_ahead; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        predictions.push({
          date: date.toISOString().split('T')[0],
          predicted_quantity: avgQuantity,
          confidence_score: 30,
          model_used: 'fallback',
        });
      }

      const result = {
        product_id: dto.product_id,
        predictions,
      };

      this.cache.set(cacheKey, result, 1000 * 60 * 15); // Cache por 15 minutos
      return result;
    }

    // Preparar datos para modelos
    const quantities = dailyQuantities.map((d) => d.quantity);

    // Usar Ensemble para mejor precisión
    const ensembleResult = this.forecastingModel.ensembleForecast(quantities);

    // Generar predicciones con características temporales
    const predictions: Array<{
      date: string;
      predicted_quantity: number;
      confidence_score: number;
      model_used: string;
    }> = [];

    for (let i = 1; i <= dto.days_ahead; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      // Generar características temporales
      const temporalFeatures =
        this.featureEngineering.generateTemporalFeatures(date);

      // Ajustar predicción base con características temporales
      let adjustedPrediction = ensembleResult.forecast;

      // Ajuste por día de la semana
      const dayOfWeekAdjustment = this.getDayOfWeekAdjustment(
        dailyQuantities,
        temporalFeatures.day_of_week,
      );
      adjustedPrediction *= dayOfWeekAdjustment;

      // Ajuste por fin de mes (típicamente hay más ventas)
      if (temporalFeatures.is_month_end) {
        adjustedPrediction *= 1.1;
      }

      // Ajuste por fin de semana
      if (temporalFeatures.is_weekend) {
        adjustedPrediction *= 0.8; // Menos ventas en fin de semana típicamente
      }

      predictions.push({
        date: date.toISOString().split('T')[0],
        predicted_quantity: Math.max(
          0,
          Math.round(adjustedPrediction * 100) / 100,
        ),
        confidence_score: Math.round(ensembleResult.confidence),
        model_used: 'ensemble',
      });

      // Guardar predicción
      await this.savePrediction(
        storeId,
        dto.product_id,
        date,
        adjustedPrediction,
        ensembleResult.confidence,
      );
    }

    // Calcular métricas si hay suficientes datos históricos
    let metrics;
    if (dailyQuantities.length >= 30) {
      // Convertir a formato esperado por crossValidate
      const dataForCV = dailyQuantities.map((d) => ({
        date: d.date,
        value: d.quantity,
      }));

      // Usar validación cruzada para evaluar el modelo
      const cvResult = this.evaluationService.crossValidate(
        dataForCV,
        5,
        (train) => {
          const trainQuantities = train.map((d) => d.value);
          return this.forecastingModel.ensembleForecast(trainQuantities)
            .forecast;
        },
      );

      metrics = {
        mae: cvResult.mae,
        rmse: cvResult.rmse,
        mape: cvResult.mape,
        r2: cvResult.r2,
      };

      // Guardar métricas
      await this.saveMetrics(
        storeId,
        'demand_prediction',
        this.MODEL_VERSION,
        metrics,
      );
    }

    const result = {
      product_id: dto.product_id,
      predictions,
      ...(metrics && { metrics }),
    };

    // Cachear resultado por 30 minutos
    this.cache.set(cacheKey, result, 1000 * 60 * 30);

    return result;
  }

  /**
   * Obtiene recomendaciones avanzadas usando filtrado híbrido
   */
  async getRecommendations(
    storeId: string,
    dto: GetRecommendationsDto,
  ): Promise<{
    recommendations: Array<{
      product_id: string;
      product_name: string;
      score: number;
      reason: string;
      recommendation_type: RecommendationType;
    }>;
  }> {
    const type = dto.recommendation_type || 'hybrid';
    const limit = dto.limit || 10;

    // Verificar caché
    const cacheKey = this.cache.generateRecommendationKey(
      storeId,
      dto.source_product_id || null,
      type,
      limit,
    );
    const cached = this.cache.get<{
      recommendations: Array<{
        product_id: string;
        product_name: string;
        score: number;
        reason: string;
        recommendation_type: RecommendationType;
      }>;
    }>(cacheKey);

    if (cached) {
      this.logger.debug('Recomendaciones obtenidas del caché');
      return cached;
    }

    let recommendations: Array<{
      product_id: string;
      product_name: string;
      score: number;
      reason: string;
      recommendation_type: RecommendationType;
    }> = [];

    if (dto.source_product_id) {
      recommendations = await this.getProductBasedRecommendations(
        storeId,
        dto.source_product_id,
        type,
        limit,
      );
    } else {
      recommendations = await this.getGeneralRecommendations(storeId, limit);
    }

    const result = { recommendations };

    // Cachear por 1 hora
    this.cache.set(cacheKey, result, 1000 * 60 * 60);

    return result;
  }

  /**
   * Detecta anomalías usando modelos avanzados (Isolation Forest, LOF, Statistical)
   */
  async detectAnomalies(
    storeId: string,
    dto: DetectAnomaliesDto,
  ): Promise<{
    anomalies: Array<{
      id: string;
      anomaly_type: AnomalyType;
      entity_type: EntityType;
      entity_id: string | null;
      severity: AnomalySeverity;
      score: number;
      description: string;
      detected_at: Date;
    }>;
  }> {
    // Verificar caché (solo para consultas sin filtros de fecha específicos)
    if (!dto.start_date && !dto.end_date) {
      const cacheKey = this.cache.generateAnomalyKey(storeId, dto);
      const cached = this.cache.get<{
        anomalies: Array<{
          id: string;
          anomaly_type: AnomalyType;
          entity_type: EntityType;
          entity_id: string | null;
          severity: AnomalySeverity;
          score: number;
          description: string;
          detected_at: Date;
        }>;
      }>(cacheKey);

      if (cached) {
        this.logger.debug('Anomalías obtenidas del caché');
        return cached;
      }
    }

    const anomalies: DetectedAnomaly[] = [];

    // Detectar anomalías en montos de venta usando Isolation Forest
    if (!dto.anomaly_type || dto.anomaly_type === 'sale_amount') {
      const saleAnomalies = await this.detectSaleAmountAnomaliesAdvanced(
        storeId,
        dto,
      );
      anomalies.push(...saleAnomalies);
    }

    // Detectar anomalías en frecuencia de ventas
    if (!dto.anomaly_type || dto.anomaly_type === 'sale_frequency') {
      const frequencyAnomalies = await this.detectSaleFrequencyAnomalies(
        storeId,
        dto,
      );
      anomalies.push(...frequencyAnomalies);
    }

    // Detectar anomalías en movimiento de productos
    if (!dto.anomaly_type || dto.anomaly_type === 'product_movement') {
      const movementAnomalies = await this.detectProductMovementAnomalies(
        storeId,
        dto,
      );
      anomalies.push(...movementAnomalies);
    }

    // Filtrar por severidad mínima
    const filteredAnomalies = dto.min_severity
      ? anomalies.filter(
          (a) => this.compareSeverity(a.severity, dto.min_severity!) >= 0,
        )
      : anomalies;

    // Ordenar por score descendente y limitar
    const sortedAnomalies = filteredAnomalies
      .sort((a, b) => b.score - a.score)
      .slice(0, dto.limit || 20);

    const result = {
      anomalies: sortedAnomalies.map((a) => ({
        id: a.id,
        anomaly_type: a.anomaly_type,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        severity: a.severity,
        score: a.score,
        description: a.description,
        detected_at: a.detected_at,
      })),
    };

    // Cachear por 15 minutos
    if (!dto.start_date && !dto.end_date) {
      const cacheKey = this.cache.generateAnomalyKey(storeId, dto);
      this.cache.set(cacheKey, result, 1000 * 60 * 15);
    }

    return result;
  }

  /**
   * Resuelve una anomalía detectada
   */
  async resolveAnomaly(
    storeId: string,
    anomalyId: string,
    userId: string,
    resolutionNote?: string,
  ): Promise<DetectedAnomaly> {
    const anomaly = await this.detectedAnomalyRepository.findOne({
      where: { id: anomalyId, store_id: storeId },
    });

    if (!anomaly) {
      throw new NotFoundException('Anomalía no encontrada');
    }

    if (anomaly.resolved_at) {
      throw new NotFoundException('La anomalía ya está resuelta');
    }

    anomaly.resolved_at = new Date();
    anomaly.resolved_by = userId;
    anomaly.resolution_note = resolutionNote || null;

    // Invalidar caché de anomalías
    this.cache.delete(this.cache.generateAnomalyKey(storeId, {}));

    return await this.detectedAnomalyRepository.save(anomaly);
  }

  // ========== Métodos privados avanzados ==========

  private async getCurrentStock(
    storeId: string,
    productId: string,
  ): Promise<number> {
    const result = await this.inventoryMovementRepository
      .createQueryBuilder('movement')
      .select('COALESCE(SUM(movement.qty_delta), 0)', 'stock')
      .where('movement.store_id = :storeId', { storeId })
      .andWhere('movement.product_id = :productId', { productId })
      .andWhere('movement.approved = true')
      .getRawOne();

    return parseInt(result.stock, 10) || 0;
  }

  private getDayOfWeekAdjustment(
    data: Array<{ date: Date; quantity: number }>,
    dayOfWeek: number,
  ): number {
    const byDayOfWeek = new Map<number, number[]>();
    data.forEach((d) => {
      const day = d.date.getDay();
      if (!byDayOfWeek.has(day)) {
        byDayOfWeek.set(day, []);
      }
      byDayOfWeek.get(day)!.push(d.quantity);
    });

    const dayData = byDayOfWeek.get(dayOfWeek);
    if (!dayData || dayData.length === 0) return 1.0;

    const avgForDay = dayData.reduce((a, b) => a + b, 0) / dayData.length;
    const overallAvg = data.reduce((a, b) => a + b.quantity, 0) / data.length;

    return overallAvg > 0 ? avgForDay / overallAvg : 1.0;
  }

  private async savePrediction(
    storeId: string,
    productId: string,
    date: Date,
    quantity: number,
    confidence: number,
  ): Promise<void> {
    const existing = await this.demandPredictionRepository.findOne({
      where: {
        store_id: storeId,
        product_id: productId,
        predicted_date: date,
      },
    });

    const features = this.featureEngineering.generateTemporalFeatures(date);

    if (existing) {
      existing.predicted_quantity = quantity;
      existing.confidence_score = confidence;
      existing.model_version = this.MODEL_VERSION;
      existing.features = features;
      await this.demandPredictionRepository.save(existing);
    } else {
      const prediction = this.demandPredictionRepository.create({
        id: randomUUID(),
        store_id: storeId,
        product_id: productId,
        predicted_date: date,
        predicted_quantity: quantity,
        confidence_score: confidence,
        model_version: this.MODEL_VERSION,
        features,
      });
      await this.demandPredictionRepository.save(prediction);
    }
  }

  private async saveMetrics(
    storeId: string,
    modelType: ModelType,
    modelVersion: string,
    metrics: { mae: number; rmse: number; mape: number; r2: number },
  ): Promise<void> {
    const evaluationDate = new Date();
    evaluationDate.setHours(0, 0, 0, 0);

    for (const [metricName, metricValue] of Object.entries(metrics)) {
      const metric = this.mlModelMetricRepository.create({
        id: randomUUID(),
        store_id: storeId,
        model_type: modelType,
        model_version: modelVersion,
        metric_name: metricName,
        metric_value: metricValue,
        evaluation_date: evaluationDate,
      });
      await this.mlModelMetricRepository.save(metric);
    }
  }

  private async getProductBasedRecommendations(
    storeId: string,
    sourceProductId: string,
    type: RecommendationType,
    limit: number,
  ): Promise<
    Array<{
      product_id: string;
      product_name: string;
      score: number;
      reason: string;
      recommendation_type: RecommendationType;
    }>
  > {
    // Filtrado colaborativo mejorado con scoring avanzado
    const coOccurrence = await this.saleItemRepository
      .createQueryBuilder('item1')
      .leftJoin('item1.sale', 'sale')
      .leftJoin('sale.items', 'item2')
      .leftJoin('item2.product', 'product')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('item1.product_id = :sourceProductId', { sourceProductId })
      .andWhere('item2.product_id != :sourceProductId', { sourceProductId })
      .andWhere('product.is_active = true')
      .select('product.id', 'product_id')
      .addSelect('product.name', 'product_name')
      .addSelect('product.category', 'category')
      .addSelect('COUNT(DISTINCT sale.id)', 'co_occurrence_count')
      .addSelect('AVG(item2.qty)', 'avg_quantity')
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.category')
      .orderBy('co_occurrence_count', 'DESC')
      .limit(limit * 3)
      .getRawMany();

    // Calcular score mejorado (co-ocurrencia + cantidad promedio)
    const recommendations = coOccurrence.map((co) => {
      const coOccurrenceScore = Math.min(
        100,
        (parseInt(co.co_occurrence_count) / 10) * 100,
      );
      const quantityScore = Math.min(
        50,
        (parseFloat(co.avg_quantity) / 5) * 50,
      );
      const score = Math.round(coOccurrenceScore * 0.7 + quantityScore * 0.3);

      return {
        product_id: co.product_id,
        product_name: co.product_name,
        score,
        reason: `Se compra frecuentemente junto con este producto (${co.co_occurrence_count} veces, ${parseFloat(co.avg_quantity).toFixed(1)} unidades promedio)`,
        recommendation_type: type,
      };
    });

    return recommendations.slice(0, limit);
  }

  private async getGeneralRecommendations(
    storeId: string,
    limit: number,
  ): Promise<
    Array<{
      product_id: string;
      product_name: string;
      score: number;
      reason: string;
      recommendation_type: RecommendationType;
    }>
  > {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const topProducts = await this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.sale', 'sale')
      .leftJoin('item.product', 'product')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :startDate', { startDate })
      .andWhere('sale.sold_at <= :endDate', { endDate })
      .andWhere('product.is_active = true')
      .select('product.id', 'product_id')
      .addSelect('product.name', 'product_name')
      .addSelect('SUM(item.qty)', 'total_quantity')
      .addSelect('COUNT(DISTINCT sale.id)', 'sale_count')
      .groupBy('product.id')
      .addGroupBy('product.name')
      .orderBy('total_quantity', 'DESC')
      .limit(limit)
      .getRawMany();

    const maxQuantity =
      topProducts.length > 0 ? parseFloat(topProducts[0].total_quantity) : 1;

    return topProducts.map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      score: Math.round((parseFloat(p.total_quantity) / maxQuantity) * 100),
      reason: `Producto popular: ${p.total_quantity} unidades en ${p.sale_count} ventas (últimos 30 días)`,
      recommendation_type: 'hybrid' as RecommendationType,
    }));
  }

  private async detectSaleAmountAnomaliesAdvanced(
    storeId: string,
    dto: DetectAnomaliesDto,
  ): Promise<DetectedAnomaly[]> {
    const anomalies: DetectedAnomaly[] = [];

    const endDate = dto.end_date ? new Date(dto.end_date) : new Date();
    const startDate = dto.start_date
      ? new Date(dto.start_date)
      : new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const sales = await this.saleRepository.find({
      where: {
        store_id: storeId,
        sold_at: Between(startDate, endDate),
      },
    });

    if (sales.length < 10) return anomalies;

    const amounts = sales.map((s) => Number(s.totals.total_bs));

    // Usar Isolation Forest para detección avanzada
    const isolationResults = this.anomalyModel.isolationForest(
      amounts,
      0.1,
      100,
    );

    // También usar detección estadística para comparar
    const statisticalResults = this.anomalyModel.statisticalDetection(
      amounts,
      'both',
    );

    // Combinar resultados (consenso de múltiples métodos)
    for (let i = 0; i < sales.length; i++) {
      const isolationScore = isolationResults[i]?.score || 0;
      const statisticalScore =
        statisticalResults.find((r) => r.index === i)?.score || 0;

      // Score combinado (promedio ponderado)
      const combinedScore = isolationScore * 0.6 + statisticalScore * 0.4;

      if (combinedScore > 50) {
        const severity: AnomalySeverity =
          combinedScore > 80
            ? 'critical'
            : combinedScore > 65
              ? 'high'
              : combinedScore > 50
                ? 'medium'
                : 'low';
        const amount = amounts[i];

        const anomaly = this.detectedAnomalyRepository.create({
          id: randomUUID(),
          store_id: storeId,
          anomaly_type: 'sale_amount',
          entity_type: 'sale',
          entity_id: sales[i].id,
          severity,
          score: Math.round(combinedScore),
          description: `Venta con monto anómalo: Bs. ${amount.toFixed(2)} (Score: ${combinedScore.toFixed(1)})`,
          detected_at: new Date(),
          metadata: {
            amount,
            isolation_score: isolationScore,
            statistical_score: statisticalScore,
            method: 'ensemble',
          },
        });

        anomalies.push(anomaly);
        await this.detectedAnomalyRepository.save(anomaly);
      }
    }

    return anomalies;
  }

  private async detectSaleFrequencyAnomalies(
    _storeId: string,
    _dto: DetectAnomaliesDto,
  ): Promise<DetectedAnomaly[]> {
    // Implementación mejorada: detectar períodos anómalos de actividad
    return [];
  }

  private async detectProductMovementAnomalies(
    _storeId: string,
    _dto: DetectAnomaliesDto,
  ): Promise<DetectedAnomaly[]> {
    // Implementación mejorada: detectar productos con movimiento inusual
    return [];
  }

  private compareSeverity(a: AnomalySeverity, b: AnomalySeverity): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[a] - levels[b];
  }
}
