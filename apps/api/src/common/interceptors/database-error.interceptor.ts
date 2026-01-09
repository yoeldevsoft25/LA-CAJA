import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { QueryFailedError } from 'typeorm';

@Injectable()
export class DatabaseErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DatabaseErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Manejar errores de conexión de PostgreSQL
        if (error instanceof QueryFailedError) {
          const message = error.message;

          // Errores de conexión terminada
          if (
            message.includes('Connection terminated unexpectedly') ||
            message.includes('Connection terminated') ||
            message.includes('server closed the connection') ||
            message.includes('connection closed')
          ) {
            this.logger.error(
              `Error de conexión a la base de datos: ${message}`,
              error.stack,
            );

            return throwError(() => ({
              statusCode: HttpStatus.SERVICE_UNAVAILABLE,
              message:
                'Error de conexión con la base de datos. Por favor, intenta nuevamente.',
              error: 'Database Connection Error',
            }));
          }

          // Errores de timeout
          if (
            message.includes('timeout') ||
            message.includes('ETIMEDOUT') ||
            message.includes('Connection timeout')
          ) {
            this.logger.error(
              `Timeout de conexión a la base de datos: ${message}`,
              error.stack,
            );

            return throwError(() => ({
              statusCode: HttpStatus.REQUEST_TIMEOUT,
              message:
                'Timeout de conexión con la base de datos. Por favor, intenta nuevamente.',
              error: 'Database Timeout Error',
            }));
          }

          // Errores de constraint único
          if (
            message.includes('unique constraint') ||
            message.includes('duplicate key') ||
            message.includes('UNIQUE constraint') ||
            error.code === '23505' // PostgreSQL unique violation code
          ) {
            this.logger.warn(
              `Violación de constraint único: ${message}`,
              error.stack,
            );

            // Extraer el nombre de la constraint si es posible
            const constraintMatch = message.match(/unique constraint "([^"]+)"/i);
            const constraintName = constraintMatch
              ? constraintMatch[1]
              : 'unknown';

            return throwError(() => ({
              statusCode: HttpStatus.CONFLICT,
              message: 'El recurso ya existe',
              error: 'Unique Constraint Violation',
              constraint: constraintName,
            }));
          }

          // Errores de foreign key
          if (
            message.includes('foreign key constraint') ||
            message.includes('FOREIGN KEY constraint') ||
            error.code === '23503' // PostgreSQL foreign key violation code
          ) {
            this.logger.error(
              `Violación de foreign key: ${message}`,
              error.stack,
            );

            return throwError(() => ({
              statusCode: HttpStatus.BAD_REQUEST,
              message:
                'Referencia inválida. El recurso relacionado no existe.',
              error: 'Foreign Key Constraint Violation',
            }));
          }

          // Errores de not null
          if (
            message.includes('not null constraint') ||
            message.includes('NOT NULL constraint') ||
            error.code === '23502' // PostgreSQL not null violation code
          ) {
            this.logger.error(
              `Violación de not null: ${message}`,
              error.stack,
            );

            const columnMatch = message.match(/column "([^"]+)"/i);
            const columnName = columnMatch ? columnMatch[1] : 'unknown';

            return throwError(() => ({
              statusCode: HttpStatus.BAD_REQUEST,
              message: `Campo requerido faltante: ${columnName}`,
              error: 'Not Null Constraint Violation',
              column: columnName,
            }));
          }

          // Otros errores de base de datos
          this.logger.error(`Error de base de datos: ${message}`, error.stack);
        }

        // Errores de conexión de pg (driver de PostgreSQL)
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          this.logger.error(
            `No se pudo conectar a la base de datos: ${error.message}`,
            error.stack,
          );

          return throwError(() => ({
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message:
              'No se pudo conectar a la base de datos. Por favor, verifica la configuración.',
            error: 'Database Connection Refused',
          }));
        }

        // Re-lanzar otros errores sin modificar
        return throwError(() => error);
      }),
    );
  }
}










