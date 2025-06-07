import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CustomLogger } from '../services/logger.service';
import { MonitoringService } from '../services/monitoring.service';
export declare class TrafficInterceptor implements NestInterceptor {
    private readonly logger;
    private readonly monitoringService;
    constructor(logger: CustomLogger, monitoringService: MonitoringService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
