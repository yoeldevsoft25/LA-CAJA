import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { QuotaGuard } from '../guards/quota.guard';

// Decorador para requerir una funcionalidad específica (ej. 'fiscal_printing')
export const RequiresFeature = (feature: string) => SetMetadata('required_feature', feature);

// Decorador para requerir espacio en una cuota (ej. 'products_count')
export const RequiresQuota = (metric: string) => SetMetadata('required_quota', metric);

// Atajo para aplicar el guard junto con los metadatos
export const CheckLicense = () => applyDecorators(UseGuards(QuotaGuard));
