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


