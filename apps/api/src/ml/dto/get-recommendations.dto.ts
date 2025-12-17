import { IsUUID, IsInt, IsOptional, IsIn, Min, Max } from 'class-validator';
import { RecommendationType } from '../../database/entities/product-recommendation.entity';

export class GetRecommendationsDto {
  @IsUUID()
  @IsOptional()
  source_product_id?: string; // Si no se proporciona, devuelve recomendaciones generales

  @IsIn(['collaborative', 'content_based', 'hybrid'])
  @IsOptional()
  recommendation_type?: RecommendationType;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;
}
