import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const method = request.method;
    const route = request.route?.path || request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - startTime) / 1000; // en segundos
          const status = response.statusCode || 200;
          this.metricsService.recordHttpRequest(
            method,
            route,
            status,
            duration,
          );
        },
        error: (error) => {
          const duration = (Date.now() - startTime) / 1000;
          const status = error.status || 500;
          this.metricsService.recordHttpRequest(
            method,
            route,
            status,
            duration,
          );
        },
      }),
    );
  }
}
