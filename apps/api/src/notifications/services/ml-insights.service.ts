import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MLInsight,
  InsightType,
  InsightSeverity,
} from '../../database/entities/ml-insight.entity';
import { DemandPrediction } from '../../database/entities/demand-prediction.entity';
import { DetectedAnomaly } from '../../database/entities/detected-anomaly.entity';
import { ProductRecommendation } from '../../database/entities/product-recommendation.entity';
import { Product } from '../../database/entities/product.entity';
import { InventoryMovement } from '../../database/entities/inventory-movement.entity';
import { randomUUID } from 'crypto';

export interface DemandInsightData {
  productId: string;
  productName: string;
  predicted: number;
  current_stock: number;
  confidence: number;
  trend: string;
  days_until_stockout?: number;
  recommended_order?: number;
}

export interface AnomalyInsightData {
  anomalyType: string;
  entityType: string;
  entityId: string | null;
  score: number;
  description: string;
  detectionMethod: string;
  metadata: Record<string, any>;
}

export interface RecommendationInsightData {
  productA: string;
  productB: string;
  score: number;
  recommendationType: string;
  reason: string;
}

/**
 * ML Insights Service
 * Genera insights inteligentes basados en los modelos de ML
 * Estos insights pueden disparar notificaciones automáticas
 */
@Injectable()
export class MLInsightsService {
  private readonly logger = new Logger(MLInsightsService.name);

  constructor(
    @InjectRepository(MLInsight)
    private mlInsightRepository: Repository<MLInsight>,
    @InjectRepository(DemandPrediction)
    private demandPredictionRepository: Repository<DemandPrediction>,
    @InjectRepository(DetectedAnomaly)
    private detectedAnomalyRepository: Repository<DetectedAnomaly>,
    @InjectRepository(ProductRecommendation)
    private productRecommendationRepository: Repository<ProductRecommendation>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(InventoryMovement)
    private inventoryMovementRepository: Repository<InventoryMovement>,
  ) {}

  /**
   * Analiza predicciones de demanda y genera insights
   */
  async analyzeProductDemand(storeId: string): Promise<MLInsight[]> {
    this.logger.log(`Analizando demanda para store ${storeId}`);

    const insights: MLInsight[] = [];

    // Obtener predicciones recientes con alta confianza
    const recentPredictions = await this.demandPredictionRepository
      .createQueryBuilder('prediction')
      .leftJoinAndSelect('prediction.product', 'product')
      .where('prediction.store_id = :storeId', { storeId })
      .andWhere('prediction.predicted_date >= CURRENT_DATE')
      .andWhere("prediction.predicted_date <= CURRENT_DATE + INTERVAL '7 days'")
      .andWhere('prediction.confidence_score >= 70')
      .orderBy('prediction.confidence_score', 'DESC')
      .limit(50)
      .getMany();

    for (const prediction of recentPredictions) {
      const product = prediction.product;
      if (!product) continue;

      const currentStock = await this.getCurrentStock(storeId, product.id);
      const predictedDemand = prediction.predicted_quantity;
      const confidence = prediction.confidence_score;

      // Insight 1: Producto "on fire" (alta demanda)
      if (confidence >= 80 && predictedDemand > currentStock * 1.5) {
        const insight = await this.createInsight({
          storeId,
          insightType: 'demand_forecast',
          insightCategory: 'product',
          entityType: 'product',
          entityId: product.id,
          modelType: 'demand_prediction',
          modelVersion: prediction.model_version,
          confidenceScore: confidence,
          title: `🔥 ${product.name} está en alta demanda`,
          description: `Demanda predicha: ${predictedDemand.toFixed(1)} unidades (${confidence.toFixed(0)}% confianza). Stock actual: ${currentStock}. Considera aumentar inventario.`,
          severity: predictedDemand > currentStock * 2 ? 'high' : 'medium',
          priority: Math.min(
            100,
            Math.round(confidence + (predictedDemand / currentStock) * 10),
          ),
          isActionable: true,
          suggestedActions: [
            {
              label: 'Ver Análisis Detallado',
              action: 'view_analytics',
              params: { productId: product.id },
              priority: 1,
            },
            {
              label: 'Aumentar Stock',
              action: 'reorder',
              params: {
                productId: product.id,
                suggestedQuantity: Math.ceil(predictedDemand * 1.2),
              },
              priority: 2,
            },
          ],
          mlData: {
            productId: product.id,
            productName: product.name,
            predicted: predictedDemand,
            current_stock: currentStock,
            confidence: confidence,
            trend: '↗ Ascending',
            prediction_features: prediction.features,
          },
        });

        insights.push(insight);
      }

      // Insight 2: Riesgo de desabasto
      if (
        confidence >= 70 &&
        currentStock < predictedDemand &&
        currentStock > 0
      ) {
        const daysUntilStockout = Math.max(
          1,
          Math.floor(currentStock / (predictedDemand / 7)),
        );
        const recommendedOrder = Math.ceil(
          predictedDemand * 1.3 - currentStock,
        );
        const lostRevenue =
          (predictedDemand - currentStock) * (product.price_bs || 0);

        const insight = await this.createInsight({
          storeId,
          insightType: 'risk',
          insightCategory: 'inventory',
          entityType: 'product',
          entityId: product.id,
          modelType: 'demand_prediction',
          modelVersion: prediction.model_version,
          confidenceScore: confidence,
          title: `⚠️ Riesgo de Desabasto: ${product.name}`,
          description: `Stock actual (${currentStock}) insuficiente para demanda predicha (${predictedDemand.toFixed(1)}). Días hasta desabasto: ${daysUntilStockout}. Ingresos en riesgo: Bs. ${lostRevenue.toFixed(2)}`,
          severity:
            daysUntilStockout <= 2
              ? 'critical'
              : daysUntilStockout <= 5
                ? 'high'
                : 'medium',
          priority: Math.min(
            100,
            Math.round(confidence + 100 / daysUntilStockout),
          ),
          isActionable: true,
          suggestedActions: [
            {
              label: 'Reordenar Ahora',
              action: 'reorder_urgent',
              params: {
                productId: product.id,
                suggestedQuantity: recommendedOrder,
                urgency: 'high',
              },
              priority: 1,
            },
          ],
          mlData: {
            productId: product.id,
            productName: product.name,
            predicted: predictedDemand,
            current_stock: currentStock,
            confidence: confidence,
            days_until_stockout: daysUntilStockout,
            recommended_order: recommendedOrder,
            lost_revenue_potential: lostRevenue,
          },
        });

        insights.push(insight);
      }

      // Insight 3: Baja rotación (overstocking)
      if (
        confidence >= 70 &&
        predictedDemand < 5 &&
        currentStock > 50 &&
        currentStock > predictedDemand * 10
      ) {
        const insight = await this.createInsight({
          storeId,
          insightType: 'opportunity',
          insightCategory: 'inventory',
          entityType: 'product',
          entityId: product.id,
          modelType: 'demand_prediction',
          modelVersion: prediction.model_version,
          confidenceScore: confidence,
          title: `📉 Baja Rotación: ${product.name}`,
          description: `Producto con baja demanda predicha (${predictedDemand.toFixed(1)} unidades/semana) y alto inventario (${currentStock}). Considera promoción o liquidación.`,
          severity: 'medium',
          priority: 60,
          isActionable: true,
          suggestedActions: [
            {
              label: 'Crear Promoción',
              action: 'create_promotion',
              params: {
                productId: product.id,
                suggestedDiscount: 20,
              },
              priority: 1,
            },
            {
              label: 'Analizar Alternativas',
              action: 'view_alternatives',
              params: { productId: product.id },
              priority: 2,
            },
          ],
          mlData: {
            productId: product.id,
            productName: product.name,
            predicted: predictedDemand,
            current_stock: currentStock,
            confidence: confidence,
            overstock_ratio: currentStock / (predictedDemand || 1),
          },
        });

        insights.push(insight);
      }
    }

    this.logger.log(`Generados ${insights.length} insights de demanda`);
    return insights;
  }

  /**
   * Analiza anomalías detectadas y genera insights
   */
  async analyzeAnomalies(storeId: string): Promise<MLInsight[]> {
    this.logger.log(`Analizando anomalías para store ${storeId}`);

    const insights: MLInsight[] = [];

    // Obtener anomalías recientes no resueltas
    const anomalies = await this.detectedAnomalyRepository
      .createQueryBuilder('anomaly')
      .where('anomaly.store_id = :storeId', { storeId })
      .andWhere('anomaly.resolved_at IS NULL')
      .andWhere("anomaly.detected_at >= NOW() - INTERVAL '24 hours'")
      .orderBy('anomaly.score', 'DESC')
      .limit(20)
      .getMany();

    for (const anomaly of anomalies) {
      const severity: InsightSeverity =
        anomaly.severity === 'critical'
          ? 'critical'
          : anomaly.severity === 'high'
            ? 'high'
            : anomaly.severity === 'medium'
              ? 'medium'
              : 'low';

      const insight = await this.createInsight({
        storeId,
        insightType: 'anomaly',
        insightCategory: 'sales',
        entityType: anomaly.entity_type,
        entityId: anomaly.entity_id || undefined,
        modelType: 'anomaly_detection',
        confidenceScore: anomaly.score,
        title: `🚨 Anomalía ${severity === 'critical' ? 'Crítica' : 'Detectada'}: ${anomaly.anomaly_type}`,
        description: anomaly.description,
        severity,
        priority: Math.round(anomaly.score),
        isActionable: true,
        suggestedActions: [
          {
            label: 'Revisar Detalles',
            action: 'view_anomaly',
            params: { anomalyId: anomaly.id },
            priority: 1,
          },
          {
            label: 'Marcar como Resuelto',
            action: 'resolve_anomaly',
            params: { anomalyId: anomaly.id },
            priority: 2,
          },
        ],
        mlData: {
          anomalyType: anomaly.anomaly_type,
          entityType: anomaly.entity_type,
          entityId: anomaly.entity_id || undefined,
          score: anomaly.score,
          description: anomaly.description,
          detectionMethod: anomaly.metadata?.['method'] || 'ensemble',
          metadata: anomaly.metadata,
        },
      });

      insights.push(insight);
    }

    this.logger.log(`Generados ${insights.length} insights de anomalías`);
    return insights;
  }

  /**
   * Analiza recomendaciones y genera insights de oportunidades
   */
  async analyzeRecommendations(storeId: string): Promise<MLInsight[]> {
    this.logger.log(`Analizando recomendaciones para store ${storeId}`);

    const insights: MLInsight[] = [];

    // Obtener recomendaciones recientes con alto score
    const recommendations = await this.productRecommendationRepository
      .createQueryBuilder('rec')
      .where('rec.store_id = :storeId', { storeId })
      .andWhere('rec.score >= 75')
      .andWhere("rec.created_at >= NOW() - INTERVAL '7 days'")
      .orderBy('rec.score', 'DESC')
      .limit(10)
      .getMany();

    for (const rec of recommendations) {
      const insight = await this.createInsight({
        storeId,
        insightType: 'recommendation',
        insightCategory: 'sales',
        entityType: 'product',
        entityId: rec.recommended_product_id,
        modelType: 'recommendation_engine',
        confidenceScore: rec.score,
        title: `🎯 Oportunidad de Cross-Selling`,
        description: `Alta probabilidad (${rec.score.toFixed(0)}%) de venta conjunta. ${rec.reason}`,
        severity: rec.score >= 90 ? 'high' : 'medium',
        priority: Math.round(rec.score),
        isActionable: true,
        suggestedActions: [
          {
            label: 'Crear Bundle',
            action: 'create_bundle',
            params: {
              sourceProductId: rec.source_product_id,
              targetProductId: rec.recommended_product_id,
            },
            priority: 1,
          },
          {
            label: 'Ver Análisis',
            action: 'view_recommendation',
            params: { recommendationId: rec.id },
            priority: 2,
          },
        ],
        mlData: {
          sourceProductId: rec.source_product_id,
          targetProductId: rec.recommended_product_id,
          score: rec.score,
          recommendationType: rec.recommendation_type,
          reason: rec.reason,
        },
      });

      insights.push(insight);
    }

    this.logger.log(`Generados ${insights.length} insights de recomendaciones`);
    return insights;
  }

  /**
   * Genera todos los insights para una tienda
   */
  async generateAllInsights(storeId: string): Promise<MLInsight[]> {
    this.logger.log(`Generando todos los insights para store ${storeId}`);

    const [demandInsights, anomalyInsights, recommendationInsights] =
      await Promise.all([
        this.analyzeProductDemand(storeId),
        this.analyzeAnomalies(storeId),
        this.analyzeRecommendations(storeId),
      ]);

    const allInsights = [
      ...demandInsights,
      ...anomalyInsights,
      ...recommendationInsights,
    ];

    this.logger.log(`Total de insights generados: ${allInsights.length}`);
    return allInsights;
  }

  /**
   * Obtiene insights activos
   */
  async getActiveInsights(
    storeId: string,
    options?: {
      insightType?: InsightType;
      severity?: InsightSeverity;
      limit?: number;
    },
  ): Promise<MLInsight[]> {
    const query = this.mlInsightRepository
      .createQueryBuilder('insight')
      .where('insight.store_id = :storeId', { storeId })
      .andWhere('insight.is_resolved = false')
      .andWhere('(insight.valid_until IS NULL OR insight.valid_until > NOW())');

    if (options?.insightType) {
      query.andWhere('insight.insight_type = :insightType', {
        insightType: options.insightType,
      });
    }

    if (options?.severity) {
      query.andWhere('insight.severity = :severity', {
        severity: options.severity,
      });
    }

    query
      .orderBy('insight.priority', 'DESC')
      .addOrderBy('insight.created_at', 'DESC');

    if (options?.limit) {
      query.limit(options.limit);
    }

    return await query.getMany();
  }

  /**
   * Marca un insight como resuelto
   */
  async resolveInsight(
    insightId: string,
    userId: string,
    note?: string,
  ): Promise<MLInsight> {
    const insight = await this.mlInsightRepository.findOne({
      where: { id: insightId },
    });

    if (!insight) {
      throw new Error('Insight not found');
    }

    insight.is_resolved = true;
    insight.resolved_at = new Date();
    insight.resolved_by = userId;
    insight.resolution_note = note || null;

    return await this.mlInsightRepository.save(insight);
  }

  /**
   * Método privado para crear un insight
   */
  private async createInsight(params: {
    storeId: string;
    insightType: InsightType;
    insightCategory: string;
    entityType?: string;
    entityId?: string;
    modelType: string;
    modelVersion?: string;
    confidenceScore?: number;
    title: string;
    description: string;
    severity: InsightSeverity;
    priority: number;
    isActionable: boolean;
    suggestedActions?: any[];
    mlData: Record<string, any>;
  }): Promise<MLInsight> {
    // Verificar si ya existe un insight similar reciente (últimas 24 horas)
    const whereCondition: any = {
      store_id: params.storeId,
      insight_type: params.insightType,
      is_resolved: false,
    };

    if (params.entityId) {
      whereCondition.entity_id = params.entityId;
    }

    const existing = await this.mlInsightRepository.findOne({
      where: whereCondition,
      order: { created_at: 'DESC' },
    });

    if (
      existing &&
      existing.created_at > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ) {
      // Actualizar el insight existente en lugar de crear uno nuevo
      existing.description = params.description;
      existing.confidence_score =
        params.confidenceScore || existing.confidence_score;
      existing.severity = params.severity;
      existing.priority = Math.round(params.priority);
      existing.ml_data = params.mlData;
      existing.suggested_actions =
        params.suggestedActions || existing.suggested_actions;
      existing.updated_at = new Date();

      return await this.mlInsightRepository.save(existing);
    }

    // Crear nuevo insight
    // Asegurar que priority sea un entero (campo INTEGER en BD)
    const priorityInt = Math.round(params.priority);
    const insight = this.mlInsightRepository.create({
      id: randomUUID(),
      store_id: params.storeId,
      insight_type: params.insightType,
      insight_category: params.insightCategory as any,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      model_type: params.modelType,
      model_version: params.modelVersion || null,
      confidence_score: params.confidenceScore || null,
      title: params.title,
      description: params.description,
      severity: params.severity,
      priority: priorityInt,
      is_actionable: params.isActionable,
      suggested_actions: params.suggestedActions || null,
      ml_data: params.mlData,
      notification_sent: false,
      is_resolved: false,
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
    });

    return await this.mlInsightRepository.save(insight);
  }

  /**
   * Obtiene el stock actual de un producto basado en inventory_movements
   */
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
}
