import { CustomLogger } from './logger.service';
export declare class MonitoringService {
    private readonly logger;
    private requestStats;
    constructor(logger: CustomLogger);
    trackRequest(method: string, endpoint: string, responseTime: number, statusCode: number): void;
    private logStats;
    getStats(): {
        totalRequests: number;
        errorCount: number;
        endpoints: {
            [key: string]: number;
        };
        responseTimeAvg: number;
        totalResponseTime: number;
    };
}
