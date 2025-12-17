import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MLController } from './ml.controller';
import { MLService } from './ml.service';
import { DemandPrediction } from '../database/entities/demand-prediction.entity';
import { ProductRecommendation } from '../database/entities/product-recommendation.entity';
import { DetectedAnomaly } from '../database/entities/detected-anomaly.entity';
import { MLModelMetric } from '../database/entities/ml-model-metric.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { FeatureEngineeringService } from './features/feature-engineering.service';
import { DemandForecastingModel } from './models/demand-forecasting.model';
import { AnomalyDetectionModel } from './models/anomaly-detection.model';
import { ModelEvaluationService } from './metrics/model-evaluation.service';
import { MLCacheService } from './cache/ml-cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DemandPrediction,
      ProductRecommendation,
      DetectedAnomaly,
      MLModelMetric,
      Sale,
      SaleItem,
      Product,
      InventoryMovement,
    ]),
  ],
  controllers: [MLController],
  providers: [
    MLService,
    FeatureEngineeringService,
    DemandForecastingModel,
    AnomalyDetectionModel,
    ModelEvaluationService,
    MLCacheService,
  ],
  exports: [MLService],
})
export class MLModule {}
