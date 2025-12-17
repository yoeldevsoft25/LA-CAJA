import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  Logger,
} from '@nestjs/common';

@Injectable()
export class CleanSaleDtoPipe implements PipeTransform {
  private readonly logger = new Logger(CleanSaleDtoPipe.name);

  transform(value: any, metadata: ArgumentMetadata) {
    // Limpiar cash_session_id si está vacío
    if (
      value &&
      (value.cash_session_id === '' ||
        value.cash_session_id === null ||
        value.cash_session_id === undefined)
    ) {
      delete value.cash_session_id;
      this.logger.debug('Limpiado cash_session_id vacío del DTO');
    }

    return value;
  }
}
