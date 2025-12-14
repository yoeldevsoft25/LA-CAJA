import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class CleanSaleDtoPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    console.log('🧹 [CleanSaleDtoPipe] Before cleaning:', {
      hasCashSessionId: !!value?.cash_session_id,
      cashSessionIdValue: value?.cash_session_id,
      cashSessionIdType: typeof value?.cash_session_id,
    });
    
    // Limpiar cash_session_id si está vacío
    if (value && (value.cash_session_id === '' || value.cash_session_id === null || value.cash_session_id === undefined)) {
      delete value.cash_session_id;
      console.log('🧹 [CleanSaleDtoPipe] Cleaned cash_session_id');
    }
    
    console.log('🧹 [CleanSaleDtoPipe] After cleaning:', {
      hasCashSessionId: !!value?.cash_session_id,
    });
    
    return value;
  }
}
