import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CustomLogger } from '../services/logger.service';
import { MonitoringService } from '../services/monitoring.service';

@Injectable()
export class TrafficInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: CustomLogger,
    private readonly monitoringService: MonitoringService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      originalUrl?: string;
      headers?: Record<string, string | string[] | undefined>;
      method?: string;
    }>();
    const now = Date.now();
    const { ip = '', originalUrl = '', headers = {}, method = '' } = request;

    // Log request
    this.logger.log(`Incoming ${method} ${originalUrl}`, 'TrafficInterceptor');

    // Monitor request size
    const contentLength = headers['content-length']
      ? parseInt(
          Array.isArray(headers['content-length'])
            ? headers['content-length'][0]
            : headers['content-length'],
          10,
        )
      : 0;
    if (contentLength > 1024 * 1024) {
      // If request size > 1MB
      this.logger.warn(
        `Large request detected: ${method} ${originalUrl} (${Math.round(contentLength / 1024)}KB)`,
        'TrafficMonitoring',
      );
    }

    return next.handle().pipe(
      tap(() => {
        // Get response status code
        const statusCode = context
          .switchToHttp()
          .getResponse<Response>().statusCode;

        // Calculate response time
        const responseTime = Date.now() - now;

        // Track request in monitoring service
        this.monitoringService.trackRequest(
          method,
          originalUrl,
          responseTime,
          statusCode,
        );

        // Log detailed traffic information
        this.logger.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),

            method,

            url: originalUrl,

            ip,

            userAgent: headers['user-agent'],
            requestSize: contentLength,
            responseTime: `${responseTime}ms`,

            statusCode,
          }),
          'TrafficMonitoring',
        );

        // Additional monitoring for slow responses
        if (responseTime > 1000) {
          this.logger.warn(
            `Slow response detected: ${method} ${originalUrl} took ${responseTime}ms`,
            'TrafficMonitoring',
          );
        }
      }),
    );
  }
}
