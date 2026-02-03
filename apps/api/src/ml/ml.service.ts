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
import { EvaluateDemandDto } from './dto/evaluate-demand.dto';
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
  private readonly MODEL_VERSION = 'v2.1'; // Versión avanzada

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
      lower_bound?: number;
      upper_bound?: number;
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

    const dailyQuantities = await this.getProductDailySales(
      storeId,
      dto.product_id,
      startDate,
      endDate,
    );
    const filledSeries = this.buildDailySeries(
      startDate,
      endDate,
      dailyQuantities,
    );
    const nonZeroDays = filledSeries.filter((d) => d.quantity > 0).length;
    const totalDays = filledSeries.length;

    // Log para diagnóstico
    this.logger.debug(
      `Producto ${dto.product_id}: ${nonZeroDays} días con ventas en los últimos ${totalDays} días`,
    );

    // Si no hay datos históricos suficientes (menos de 7 días con ventas)
    if (nonZeroDays < 7) {
      this.logger.warn(
        `Producto ${dto.product_id}: Solo ${nonZeroDays} días con ventas. Usando modelo fallback.`,
      );

      // Calcular promedio basado en datos disponibles si hay alguno
      let avgQuantity = 1;
      if (nonZeroDays > 0) {
        const totalQuantity = filledSeries.reduce(
          (sum, d) => sum + d.quantity,
          0,
        );
        avgQuantity = totalQuantity / totalDays;
      } else {
        // Si no hay ventas, usar stock actual como referencia
        const currentStock = await this.getCurrentStock(
          storeId,
          dto.product_id,
        );
        avgQuantity = currentStock > 0 ? currentStock / 7 : 1;
      }

      const croston = this.forecastingModel.crostonForecast(
        filledSeries.map((d) => d.quantity),
      );
      const baseline = nonZeroDays > 0 ? croston.forecast : avgQuantity;

      const predictions: Array<{
        date: string;
        predicted_quantity: number;
        confidence_score: number;
        model_used: string;
        lower_bound?: number;
        upper_bound?: number;
      }> = [];

      for (let i = 1; i <= dto.days_ahead; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const predicted = Math.max(0, Math.round(baseline * 100) / 100);
        const interval = predicted > 0 ? predicted * 0.3 : 1;
        const lowerBound = Math.max(
          0,
          Math.round((predicted - interval) * 100) / 100,
        );
        const upperBound = Math.max(
          0,
          Math.round((predicted + interval) * 100) / 100,
        );
        predictions.push({
          date: date.toISOString().split('T')[0],
          predicted_quantity: predicted,
          confidence_score:
            nonZeroDays > 0 ? Math.min(50, 20 + nonZeroDays * 4) : 15,
          model_used: nonZeroDays > 0 ? 'croston' : 'cold_start',
          lower_bound: lowerBound,
          upper_bound: upperBound,
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
    const quantities = filledSeries.map((d) => d.quantity);
    const seriesData = filledSeries.map((d) => ({
      date: d.date,
      value: d.quantity,
    }));
    const zeroRatio = totalDays > 0 ? (totalDays - nonZeroDays) / totalDays : 0;
    const ensembleResult = this.forecastingModel.ensembleForecast(quantities);
    const { bestModel, bestEvaluation, selectedModel } =
      this.evaluateForecastModels(seriesData, quantities, zeroRatio);

    const baseForecast = selectedModel.forecast(quantities);
    const seriesStats = this.getSeriesStats(quantities);
    const trendFeatures =
      this.featureEngineering.generateTrendFeatures(seriesData);
    const errorStats = this.getErrorStats(bestEvaluation?.residuals || []);
    const baseConfidence = bestEvaluation
      ? this.calculateConfidenceFromError(bestEvaluation.mae, seriesStats.mean)
      : ensembleResult.confidence;
    const volatilityPenalty =
      seriesStats.mean > 0 && trendFeatures.volatility > 0
        ? Math.min(15, (trendFeatures.volatility / seriesStats.mean) * 10)
        : 0;
    const predictionConfidence = this.clamp(
      baseConfidence - (zeroRatio > 0.4 ? 10 : 0) - volatilityPenalty,
      5,
      95,
    );
    const intervalFallback =
      seriesStats.mean > 0 ? Math.max(1, seriesStats.mean * 0.3) : 1;
    const modelVersion = `${this.MODEL_VERSION}-${bestModel}`;

    // Generar predicciones con características temporales
    const predictions: Array<{
      date: string;
      predicted_quantity: number;
      confidence_score: number;
      model_used: string;
      lower_bound?: number;
      upper_bound?: number;
    }> = [];

    const trendFactor =
      seriesStats.mean > 0
        ? 1 + this.clamp(trendFeatures.trend / seriesStats.mean, -0.2, 0.2)
        : 1;
    const momentumFactor =
      seriesStats.recentMean > 0 && seriesStats.mean > 0
        ? this.clamp(seriesStats.recentMean / seriesStats.mean, 0.7, 1.3)
        : 1;
    const volatilityFactor =
      seriesStats.mean > 0
        ? 1 - Math.min(0.2, trendFeatures.volatility / seriesStats.mean / 2)
        : 1;

    for (let i = 1; i <= dto.days_ahead; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      // Generar características temporales
      const temporalFeatures =
        this.featureEngineering.generateTemporalFeatures(date);

      // Ajustar predicción base con características temporales
      let adjustedPrediction = baseForecast;

      // Ajuste por día de la semana
      const dayOfWeekAdjustment = this.getDayOfWeekAdjustment(
        filledSeries,
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

      // Ajuste por tendencia y momentum reciente
      adjustedPrediction *= trendFactor * momentumFactor * volatilityFactor;

      const interval = errorStats.hasResiduals
        ? errorStats.stdDev * 1.28
        : intervalFallback;
      const lowerCandidate =
        adjustedPrediction +
        (errorStats.hasResiduals ? errorStats.p10 : -interval);
      const upperCandidate =
        adjustedPrediction +
        (errorStats.hasResiduals ? errorStats.p90 : interval);
      const lowerBound = Math.max(
        0,
        Math.round(Math.min(lowerCandidate, upperCandidate) * 100) / 100,
      );
      const upperBound = Math.max(
        0,
        Math.round(Math.max(lowerCandidate, upperCandidate) * 100) / 100,
      );

      const finalPrediction = Math.max(
        0,
        Math.round(adjustedPrediction * 100) / 100,
      );

      predictions.push({
        date: date.toISOString().split('T')[0],
        predicted_quantity: finalPrediction,
        confidence_score: Math.round(predictionConfidence),
        model_used: bestModel,
        lower_bound: lowerBound,
        upper_bound: upperBound,
      });

      // Guardar predicción
      await this.savePrediction(
        storeId,
        dto.product_id,
        date,
        finalPrediction,
        predictionConfidence,
        {
          modelVersion,
          features: {
            model_used: bestModel,
            lower_bound: lowerBound,
            upper_bound: upperBound,
            confidence_score: Math.round(predictionConfidence),
            zero_ratio: Number(zeroRatio.toFixed(2)),
          },
        },
      );
    }

    // Calcular métricas si hay suficientes datos históricos
    let metrics;
    if (bestEvaluation && bestEvaluation.fold_scores.length > 0) {
      metrics = {
        mae: bestEvaluation.mae,
        rmse: bestEvaluation.rmse,
        mape: bestEvaluation.mape,
        r2: bestEvaluation.r2,
      };

      // Guardar métricas
      await this.saveMetrics(
        storeId,
        'demand_prediction',
        modelVersion,
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
   * Evalúa modelos de predicción de demanda usando walk-forward
   */
  async evaluateDemandForecasting(
    storeId: string,
    dto: EvaluateDemandDto,
  ): Promise<{
    evaluated_at: string;
    days_back: number;
    horizon: number;
    min_train_size: number;
    max_folds: number;
    evaluations: Array<{
      product_id: string;
      product_name?: string;
      status: 'ok' | 'insufficient_data' | 'not_found';
      data_stats: {
        total_days: number;
        non_zero_days: number;
        zero_ratio: number;
        mean: number;
        recent_mean: number;
      };
      validation: {
        min_train_size: number;
        max_folds: number;
        horizon: number;
      };
      best_model?: string;
      metrics?: {
        mae: number;
        rmse: number;
        mape: number;
        r2: number;
      };
      model_metrics?: Array<{
        model: string;
        mae: number;
        rmse: number;
        mape: number;
        r2: number;
        folds: number;
      }>;
      note?: string;
    }>;
  }> {
    const daysBack = dto.days_back ?? 180;
    const horizon = dto.horizon ?? 1;
    const maxFolds = dto.max_folds ?? 30;
    const topN = dto.top_n ?? 3;
    const requestedProductIds = dto.product_ids || [];

    const productIds =
      requestedProductIds.length > 0
        ? requestedProductIds
        : await this.getTopProductsBySales(storeId, topN, daysBack);

    const uniqueProductIds = Array.from(new Set(productIds));

    const evaluations: Array<{
      product_id: string;
      product_name?: string;
      status: 'ok' | 'insufficient_data' | 'not_found';
      data_stats: {
        total_days: number;
        non_zero_days: number;
        zero_ratio: number;
        mean: number;
        recent_mean: number;
      };
      validation: {
        min_train_size: number;
        max_folds: number;
        horizon: number;
      };
      best_model?: string;
      metrics?: {
        mae: number;
        rmse: number;
        mape: number;
        r2: number;
      };
      model_metrics?: Array<{
        model: string;
        mae: number;
        rmse: number;
        mape: number;
        r2: number;
        folds: number;
      }>;
      note?: string;
    }> = [];

    if (uniqueProductIds.length === 0) {
      return {
        evaluated_at: new Date().toISOString(),
        days_back: daysBack,
        horizon,
        min_train_size: dto.min_train_size ?? 0,
        max_folds: maxFolds,
        evaluations,
      };
    }

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - daysBack);

    for (const productId of uniqueProductIds) {
      const product = await this.productRepository.findOne({
        where: { id: productId, store_id: storeId },
      });

      if (!product) {
        evaluations.push({
          product_id: productId,
          status: 'not_found',
          data_stats: {
            total_days: 0,
            non_zero_days: 0,
            zero_ratio: 0,
            mean: 0,
            recent_mean: 0,
          },
          validation: {
            min_train_size: dto.min_train_size ?? 0,
            max_folds: maxFolds,
            horizon,
          },
          note: 'Producto no encontrado',
        });
        continue;
      }

      const dailyQuantities = await this.getProductDailySales(
        storeId,
        productId,
        startDate,
        endDate,
      );
      const filledSeries = this.buildDailySeries(
        startDate,
        endDate,
        dailyQuantities,
      );
      const quantities = filledSeries.map((d) => d.quantity);
      const seriesData = filledSeries.map((d) => ({
        date: d.date,
        value: d.quantity,
      }));
      const totalDays = filledSeries.length;
      const nonZeroDays = filledSeries.filter((d) => d.quantity > 0).length;
      const zeroRatio =
        totalDays > 0 ? (totalDays - nonZeroDays) / totalDays : 0;
      const seriesStats = this.getSeriesStats(quantities);

      if (nonZeroDays < 7) {
        evaluations.push({
          product_id: productId,
          product_name: product.name,
          status: 'insufficient_data',
          data_stats: {
            total_days: totalDays,
            non_zero_days: nonZeroDays,
            zero_ratio: Number(zeroRatio.toFixed(2)),
            mean: Number(seriesStats.mean.toFixed(2)),
            recent_mean: Number(seriesStats.recentMean.toFixed(2)),
          },
          validation: {
            min_train_size: dto.min_train_size ?? 0,
            max_folds: maxFolds,
            horizon,
          },
          note: 'Histórico insuficiente para evaluación (mínimo 7 días con ventas).',
        });
        continue;
      }

      const evaluation = this.evaluateForecastModels(
        seriesData,
        quantities,
        zeroRatio,
        {
          minTrainSize: dto.min_train_size,
          maxFolds,
          horizon,
        },
      );

      const modelMetrics = Array.from(evaluation.modelEvaluations.entries())
        .map(([model, metrics]) => ({
          model,
          mae: metrics.mae,
          rmse: metrics.rmse,
          mape: metrics.mape,
          r2: metrics.r2,
          folds: metrics.fold_scores.length,
        }))
        .sort((a, b) => a.mae - b.mae);

      evaluations.push({
        product_id: productId,
        product_name: product.name,
        status: evaluation.bestEvaluation ? 'ok' : 'insufficient_data',
        data_stats: {
          total_days: totalDays,
          non_zero_days: nonZeroDays,
          zero_ratio: Number(zeroRatio.toFixed(2)),
          mean: Number(seriesStats.mean.toFixed(2)),
          recent_mean: Number(seriesStats.recentMean.toFixed(2)),
        },
        validation: {
          min_train_size: evaluation.validation.minTrainSize,
          max_folds: evaluation.validation.maxFolds,
          horizon: evaluation.validation.horizon,
        },
        best_model: evaluation.bestModel,
        metrics: evaluation.bestEvaluation
          ? {
              mae: evaluation.bestEvaluation.mae,
              rmse: evaluation.bestEvaluation.rmse,
              mape: evaluation.bestEvaluation.mape,
              r2: evaluation.bestEvaluation.r2,
            }
          : undefined,
        model_metrics: modelMetrics.length > 0 ? modelMetrics : undefined,
        note:
          evaluation.bestEvaluation || modelMetrics.length > 0
            ? undefined
            : 'No hay folds suficientes para evaluación walk-forward.',
      });
    }

    return {
      evaluated_at: new Date().toISOString(),
      days_back: daysBack,
      horizon,
      min_train_size: dto.min_train_size ?? 0,
      max_folds: maxFolds,
      evaluations,
    };
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
      recommendations = await this.getGeneralRecommendations(
        storeId,
        limit,
        type,
      );
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

  private formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private async getProductDailySales(
    storeId: string,
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: Date; quantity: number }>> {
    const sales = await this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.sale', 'sale')
      .where('item.product_id = :productId', { productId })
      .andWhere('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :startDate', { startDate })
      .andWhere('sale.sold_at <= :endDate', { endDate })
      .select('DATE(sale.sold_at)', 'date')
      .addSelect('SUM(item.qty)', 'total_qty')
      .groupBy('DATE(sale.sold_at)')
      .orderBy('DATE(sale.sold_at)', 'ASC')
      .getRawMany();

    return sales.map((row) => ({
      date: new Date(row.date),
      quantity: parseFloat(row.total_qty) || 0,
    }));
  }

  private async getTopProductsBySales(
    storeId: string,
    limit: number,
    daysBack: number,
  ): Promise<string[]> {
    if (limit <= 0) return [];

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - daysBack);

    const rows = await this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.sale', 'sale')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :startDate', { startDate })
      .andWhere('sale.sold_at <= :endDate', { endDate })
      .select('item.product_id', 'product_id')
      .addSelect('SUM(item.qty)', 'total_qty')
      .groupBy('item.product_id')
      .orderBy('total_qty', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((row) => row.product_id);
  }

  private buildDailySeries(
    startDate: Date,
    endDate: Date,
    data: Array<{ date: Date; quantity: number }>,
  ): Array<{ date: Date; quantity: number }> {
    const byDate = new Map<string, number>();
    for (const entry of data) {
      const key = this.formatDateKey(entry.date);
      byDate.set(key, (byDate.get(key) || 0) + entry.quantity);
    }

    const series: Array<{ date: Date; quantity: number }> = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (cursor <= end) {
      const key = this.formatDateKey(cursor);
      series.push({
        date: new Date(cursor),
        quantity: byDate.get(key) || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return series;
  }

  private getForecastModelCandidates(
    quantities: number[],
    zeroRatio: number,
    seasonLength: number,
  ): Array<{
    id: string;
    enabled: boolean;
    forecast: (values: number[]) => number;
  }> {
    return [
      {
        id: 'ensemble',
        enabled: true,
        forecast: (values: number[]) =>
          this.forecastingModel.ensembleForecast(values).forecast,
      },
      {
        id: 'croston',
        enabled: true,
        forecast: (values: number[]) =>
          this.forecastingModel.crostonForecast(values).forecast,
      },
      {
        id: 'croston_ensemble',
        enabled: zeroRatio > 0.4,
        forecast: (values: number[]) => {
          const ensemble = this.forecastingModel.ensembleForecast(values);
          const croston = this.forecastingModel.crostonForecast(values);
          return ensemble.forecast * 0.6 + croston.forecast * 0.4;
        },
      },
      {
        id: 'seasonal_naive',
        enabled: quantities.length >= seasonLength,
        forecast: (values: number[]) =>
          this.forecastingModel.seasonalNaive(values, seasonLength),
      },
      {
        id: 'moving_avg',
        enabled: quantities.length >= 3,
        forecast: (values: number[]) =>
          this.forecastingModel.movingAverageForecast(values, seasonLength),
      },
    ];
  }

  private evaluateForecastModels(
    seriesData: Array<{ date: Date; value: number }>,
    quantities: number[],
    zeroRatio: number,
    options: {
      minTrainSize?: number;
      maxFolds?: number;
      horizon?: number;
      seasonLength?: number;
    } = {},
  ): {
    candidates: Array<{
      id: string;
      enabled: boolean;
      forecast: (values: number[]) => number;
    }>;
    modelEvaluations: Map<
      string,
      ReturnType<ModelEvaluationService['walkForwardValidate']>
    >;
    bestModel: string;
    bestEvaluation: ReturnType<
      ModelEvaluationService['walkForwardValidate']
    > | null;
    selectedModel: {
      id: string;
      enabled: boolean;
      forecast: (values: number[]) => number;
    };
    validation: {
      minTrainSize: number;
      maxFolds: number;
      horizon: number;
    };
  } {
    const seasonLength = options.seasonLength ?? 7;
    const horizon = Math.max(1, options.horizon ?? 1);
    const minTrainCandidate =
      options.minTrainSize ??
      Math.min(30, Math.max(7, Math.floor(seriesData.length * 0.6)));
    const maxTrainSize = Math.max(2, seriesData.length - horizon);
    const minTrainSize = Math.min(minTrainCandidate, maxTrainSize);
    const maxFoldsCandidate = Math.max(0, seriesData.length - minTrainSize);
    const maxFolds = Math.min(options.maxFolds ?? 30, maxFoldsCandidate);

    const candidates = this.getForecastModelCandidates(
      quantities,
      zeroRatio,
      seasonLength,
    );
    const modelEvaluations = new Map<
      string,
      ReturnType<ModelEvaluationService['walkForwardValidate']>
    >();

    if (maxFolds >= 5) {
      for (const candidate of candidates) {
        if (!candidate.enabled) continue;

        const evaluation = this.evaluationService.walkForwardValidate(
          seriesData,
          {
            minTrainSize,
            horizon,
            maxFolds,
          },
          (train) => candidate.forecast(train.map((d) => d.value)),
        );

        if (evaluation.fold_scores.length > 0) {
          modelEvaluations.set(candidate.id, evaluation);
        }
      }
    }

    let fallbackModel = zeroRatio > 0.4 ? 'croston_ensemble' : 'ensemble';
    let bestEvaluation: ReturnType<
      ModelEvaluationService['walkForwardValidate']
    > | null = null;

    if (modelEvaluations.size > 0) {
      const sorted = Array.from(modelEvaluations.entries()).sort(
        (a, b) => a[1].mae - b[1].mae,
      );
      fallbackModel = sorted[0]?.[0] || fallbackModel;
      bestEvaluation = sorted[0]?.[1] || null;
    }

    const selectedModel = candidates.find(
      (candidate) => candidate.id === fallbackModel,
    )?.enabled
      ? candidates.find((candidate) => candidate.id === fallbackModel)!
      : candidates.find((candidate) => candidate.enabled) || candidates[0];

    return {
      candidates,
      modelEvaluations,
      bestModel: selectedModel.id,
      bestEvaluation,
      selectedModel,
      validation: {
        minTrainSize,
        maxFolds,
        horizon,
      },
    };
  }

  private getSeriesStats(
    values: number[],
    recentWindow: number = 14,
  ): { mean: number; recentMean: number } {
    if (values.length === 0) {
      return { mean: 0, recentMean: 0 };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const recent = values.slice(-recentWindow);
    const recentMean =
      recent.length > 0
        ? recent.reduce((a, b) => a + b, 0) / recent.length
        : mean;

    return { mean, recentMean };
  }

  private getErrorStats(residuals: number[]): {
    hasResiduals: boolean;
    stdDev: number;
    p10: number;
    p90: number;
  } {
    if (residuals.length === 0) {
      return { hasResiduals: false, stdDev: 0, p10: 0, p90: 0 };
    }

    const mean =
      residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
    const variance =
      residuals.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) /
      residuals.length;
    const stdDev = Math.sqrt(variance);
    const sorted = [...residuals].sort((a, b) => a - b);
    const p10Index = Math.floor((sorted.length - 1) * 0.1);
    const p90Index = Math.floor((sorted.length - 1) * 0.9);

    return {
      hasResiduals: true,
      stdDev,
      p10: sorted[p10Index],
      p90: sorted[p90Index],
    };
  }

  private calculateConfidenceFromError(mae: number, mean: number): number {
    if (mean <= 0) return 0;
    const ratio = mae / mean;
    return this.clamp(100 - ratio * 100, 5, 95);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

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
    options?: {
      modelVersion?: string;
      features?: Record<string, any>;
    },
  ): Promise<void> {
    const existing = await this.demandPredictionRepository.findOne({
      where: {
        store_id: storeId,
        product_id: productId,
        predicted_date: date,
      },
    });

    const features = {
      ...this.featureEngineering.generateTemporalFeatures(date),
      ...(options?.features || {}),
    };

    if (existing) {
      existing.predicted_quantity = quantity;
      existing.confidence_score = confidence;
      existing.model_version = options?.modelVersion || this.MODEL_VERSION;
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
        model_version: options?.modelVersion || this.MODEL_VERSION,
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
    const collaborative = await this.getCollaborativeRecommendations(
      storeId,
      sourceProductId,
      limit,
    );

    if (type === 'collaborative') {
      return collaborative.slice(0, limit);
    }

    const contentBased = await this.getContentBasedRecommendations(
      storeId,
      sourceProductId,
      limit,
    );

    if (type === 'content_based') {
      return contentBased.slice(0, limit);
    }

    return this.mergeRecommendations(collaborative, contentBased, limit);
  }

  private async getCollaborativeRecommendations(
    storeId: string,
    sourceProductId: string,
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
        recommendation_type: 'collaborative' as RecommendationType,
      };
    });

    return recommendations.slice(0, limit);
  }

  private async getGeneralRecommendations(
    storeId: string,
    limit: number,
    type: RecommendationType = 'hybrid',
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
      recommendation_type: type,
    }));
  }

  private async getContentBasedRecommendations(
    storeId: string,
    sourceProductId: string,
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
    const sourceProduct = await this.productRepository.findOne({
      where: { id: sourceProductId, store_id: storeId },
    });

    if (!sourceProduct) {
      return [];
    }

    if (!sourceProduct.category) {
      return this.getGeneralRecommendations(storeId, limit, 'content_based');
    }

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const similarProducts = await this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.sale', 'sale')
      .leftJoin('item.product', 'product')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :startDate', { startDate })
      .andWhere('sale.sold_at <= :endDate', { endDate })
      .andWhere('product.is_active = true')
      .andWhere('product.category = :category', {
        category: sourceProduct.category,
      })
      .andWhere('product.id != :sourceProductId', { sourceProductId })
      .select('product.id', 'product_id')
      .addSelect('product.name', 'product_name')
      .addSelect('SUM(item.qty)', 'total_quantity')
      .addSelect('COUNT(DISTINCT sale.id)', 'sale_count')
      .groupBy('product.id')
      .addGroupBy('product.name')
      .orderBy('total_quantity', 'DESC')
      .limit(limit)
      .getRawMany();

    if (similarProducts.length === 0) {
      return this.getGeneralRecommendations(storeId, limit, 'content_based');
    }

    const maxQuantity =
      similarProducts.length > 0
        ? parseFloat(similarProducts[0].total_quantity)
        : 1;

    return similarProducts.map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      score: Math.round((parseFloat(p.total_quantity) / maxQuantity) * 100),
      reason: `Misma categoría (${sourceProduct.category}): ${p.total_quantity} unidades en ${p.sale_count} ventas`,
      recommendation_type: 'content_based' as RecommendationType,
    }));
  }

  private mergeRecommendations(
    collaborative: Array<{
      product_id: string;
      product_name: string;
      score: number;
      reason: string;
      recommendation_type: RecommendationType;
    }>,
    contentBased: Array<{
      product_id: string;
      product_name: string;
      score: number;
      reason: string;
      recommendation_type: RecommendationType;
    }>,
    limit: number,
  ): Array<{
    product_id: string;
    product_name: string;
    score: number;
    reason: string;
    recommendation_type: RecommendationType;
  }> {
    const merged = new Map<
      string,
      {
        product_id: string;
        product_name: string;
        collaborativeScore?: number;
        contentScore?: number;
        collaborativeReason?: string;
        contentReason?: string;
      }
    >();

    for (const rec of collaborative) {
      merged.set(rec.product_id, {
        product_id: rec.product_id,
        product_name: rec.product_name,
        collaborativeScore: rec.score,
        collaborativeReason: rec.reason,
      });
    }

    for (const rec of contentBased) {
      const existing = merged.get(rec.product_id);
      if (existing) {
        existing.contentScore = rec.score;
        existing.contentReason = rec.reason;
      } else {
        merged.set(rec.product_id, {
          product_id: rec.product_id,
          product_name: rec.product_name,
          contentScore: rec.score,
          contentReason: rec.reason,
        });
      }
    }

    const results = Array.from(merged.values()).map((entry) => {
      const collab = entry.collaborativeScore ?? 0;
      const content = entry.contentScore ?? 0;
      const hasCollab = entry.collaborativeScore !== undefined;
      const hasContent = entry.contentScore !== undefined;
      const score =
        hasCollab && hasContent
          ? collab * 0.7 + content * 0.3
          : collab + content;
      const reason =
        hasCollab && hasContent
          ? 'Se compra frecuentemente junto con este producto y pertenece a la misma categoría'
          : entry.collaborativeReason ||
            entry.contentReason ||
            'Recomendación híbrida';

      return {
        product_id: entry.product_id,
        product_name: entry.product_name,
        score: Math.round(score),
        reason,
        recommendation_type: 'hybrid' as RecommendationType,
      };
    });

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
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
        const existing = await this.detectedAnomalyRepository.findOne({
          where: {
            store_id: storeId,
            anomaly_type: 'sale_amount',
            entity_type: 'sale',
            entity_id: sales[i].id,
          },
        });

        if (existing) {
          anomalies.push(existing);
          continue;
        }

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
    storeId: string,
    dto: DetectAnomaliesDto,
  ): Promise<DetectedAnomaly[]> {
    const anomalies: DetectedAnomaly[] = [];

    if (dto.entity_type && dto.entity_type !== 'sale') {
      return anomalies;
    }

    const endDate = dto.end_date ? new Date(dto.end_date) : new Date();
    const startDate = dto.start_date
      ? new Date(dto.start_date)
      : new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const dailyCountsRaw = await this.saleRepository
      .createQueryBuilder('sale')
      .select('DATE(sale.sold_at)', 'date')
      .addSelect('COUNT(*)', 'total_sales')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :startDate', { startDate })
      .andWhere('sale.sold_at <= :endDate', { endDate })
      .groupBy('DATE(sale.sold_at)')
      .orderBy('DATE(sale.sold_at)', 'ASC')
      .getRawMany();

    const dailyCounts = dailyCountsRaw.map((row) => ({
      date: new Date(row.date),
      quantity: parseInt(row.total_sales, 10) || 0,
    }));
    const series = this.buildDailySeries(startDate, endDate, dailyCounts);

    if (series.length < 7) return anomalies;

    const counts = series.map((d) => d.quantity);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance =
      counts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      counts.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return anomalies;

    for (const day of series) {
      const zScore = (day.quantity - mean) / stdDev;
      const absZ = Math.abs(zScore);

      if (absZ < 2.5) continue;

      const severity: AnomalySeverity =
        absZ > 3.5 ? 'critical' : absZ > 3 ? 'high' : 'medium';
      const score = Math.min(100, absZ * 20);
      const dateKey = this.formatDateKey(day.date);

      const existing = await this.detectedAnomalyRepository
        .createQueryBuilder('anomaly')
        .where('anomaly.store_id = :storeId', { storeId })
        .andWhere('anomaly.anomaly_type = :type', {
          type: 'sale_frequency',
        })
        .andWhere("anomaly.metadata->>'date' = :dateKey", { dateKey })
        .getOne();

      if (existing) {
        anomalies.push(existing);
        continue;
      }

      const anomaly = this.detectedAnomalyRepository.create({
        id: randomUUID(),
        store_id: storeId,
        anomaly_type: 'sale_frequency',
        entity_type: 'sale',
        entity_id: null,
        severity,
        score: Math.round(score),
        description: `Actividad de ventas anómala: ${day.quantity} ventas (media ${mean.toFixed(1)})`,
        detected_at: day.date,
        metadata: {
          date: dateKey,
          sales_count: day.quantity,
          mean: Number(mean.toFixed(2)),
          z_score: Number(zScore.toFixed(2)),
          std_dev: Number(stdDev.toFixed(2)),
        },
      });

      anomalies.push(anomaly);
      await this.detectedAnomalyRepository.save(anomaly);
    }

    return anomalies;
  }

  private async detectProductMovementAnomalies(
    storeId: string,
    dto: DetectAnomaliesDto,
  ): Promise<DetectedAnomaly[]> {
    const anomalies: DetectedAnomaly[] = [];

    if (dto.entity_type && dto.entity_type !== 'product') {
      return anomalies;
    }

    const endDate = dto.end_date ? new Date(dto.end_date) : new Date();
    const startDate = dto.start_date
      ? new Date(dto.start_date)
      : new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const movements = await this.inventoryMovementRepository
      .createQueryBuilder('movement')
      .leftJoin('movement.product', 'product')
      .select('movement.product_id', 'product_id')
      .addSelect('product.name', 'product_name')
      .addSelect('SUM(ABS(movement.qty_delta))', 'total_movement')
      .where('movement.store_id = :storeId', { storeId })
      .andWhere('movement.approved = true')
      .andWhere('movement.happened_at >= :startDate', { startDate })
      .andWhere('movement.happened_at <= :endDate', { endDate })
      .groupBy('movement.product_id')
      .addGroupBy('product.name')
      .getRawMany();

    if (movements.length < 5) return anomalies;

    const totals = movements.map((m) => parseFloat(m.total_movement) || 0);
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const variance =
      totals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      totals.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return anomalies;

    const rangeStart = this.formatDateKey(startDate);
    const rangeEnd = this.formatDateKey(endDate);

    for (const movement of movements) {
      const totalMovement = parseFloat(movement.total_movement) || 0;
      const zScore = (totalMovement - mean) / stdDev;

      if (zScore < 2.5) continue;

      const severity: AnomalySeverity =
        zScore > 3.5 ? 'critical' : zScore > 3 ? 'high' : 'medium';
      const score = Math.min(100, zScore * 20);

      const existing = await this.detectedAnomalyRepository
        .createQueryBuilder('anomaly')
        .where('anomaly.store_id = :storeId', { storeId })
        .andWhere('anomaly.anomaly_type = :type', {
          type: 'product_movement',
        })
        .andWhere('anomaly.entity_id = :productId', {
          productId: movement.product_id,
        })
        .andWhere("anomaly.metadata->>'range_end' = :rangeEnd", { rangeEnd })
        .getOne();

      if (existing) {
        anomalies.push(existing);
        continue;
      }

      const anomaly = this.detectedAnomalyRepository.create({
        id: randomUUID(),
        store_id: storeId,
        anomaly_type: 'product_movement',
        entity_type: 'product',
        entity_id: movement.product_id,
        severity,
        score: Math.round(score),
        description: `Movimiento inusual: ${movement.product_name} (${totalMovement} unidades en 30 días)`,
        detected_at: new Date(),
        metadata: {
          product_id: movement.product_id,
          product_name: movement.product_name,
          total_movement: Number(totalMovement.toFixed(2)),
          range_start: rangeStart,
          range_end: rangeEnd,
          mean: Number(mean.toFixed(2)),
          z_score: Number(zScore.toFixed(2)),
          std_dev: Number(stdDev.toFixed(2)),
        },
      });

      anomalies.push(anomaly);
      await this.detectedAnomalyRepository.save(anomaly);
    }

    return anomalies;
  }

  private compareSeverity(a: AnomalySeverity, b: AnomalySeverity): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[a] - levels[b];
  }
}
