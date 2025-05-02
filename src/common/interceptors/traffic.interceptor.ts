/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();
    const now = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { ip, method, originalUrl, headers } = request;

    // Log request
    this.logger.log(`Incoming ${method} ${originalUrl}`, 'TrafficInterceptor');

    // Monitor request size
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const contentLength = headers['content-length']
      ? parseInt(headers['content-length'], 10)
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
        // Removed 'response' parameter as it's not used
        const responseTime = Date.now() - now;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const statusCode = context.switchToHttp().getResponse().statusCode;

        // Track request in monitoring service
        this.monitoringService.trackRequest(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          method,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          originalUrl,
          responseTime,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          statusCode,
        );

        // Log detailed traffic information
        this.logger.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            method,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            url: originalUrl,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            ip,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            userAgent: headers['user-agent'],
            requestSize: contentLength,
            responseTime: `${responseTime}ms`,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
