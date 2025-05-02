import { Injectable } from '@nestjs/common';
import { CustomLogger } from './logger.service';

@Injectable()
export class MonitoringService {
  private requestStats: {
    totalRequests: number;
    errorCount: number;
    endpoints: { [key: string]: number };
    responseTimeAvg: number;
    totalResponseTime: number;
  } = {
    totalRequests: 0,
    errorCount: 0,
    endpoints: {},
    responseTimeAvg: 0,
    totalResponseTime: 0,
  };

  constructor(private readonly logger: CustomLogger) {}

  trackRequest(
    method: string,
    endpoint: string,
    responseTime: number,
    statusCode: number,
  ) {
    this.requestStats.totalRequests++;
    this.requestStats.totalResponseTime += responseTime;
    this.requestStats.responseTimeAvg =
      this.requestStats.totalResponseTime / this.requestStats.totalRequests;

    const key = `${method} ${endpoint}`;
    this.requestStats.endpoints[key] =
      (this.requestStats.endpoints[key] || 0) + 1;

    if (statusCode >= 400) {
      this.requestStats.errorCount++;
    }

    // Log stats every 100 requests
    if (this.requestStats.totalRequests % 100 === 0) {
      this.logStats();
    }
  }

  private logStats() {
    this.logger.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        stats: {
          totalRequests: this.requestStats.totalRequests,
          errorRate:
            (this.requestStats.errorCount / this.requestStats.totalRequests) *
            100,
          avgResponseTime: Math.round(this.requestStats.responseTimeAvg),
          topEndpoints: Object.entries(this.requestStats.endpoints)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5),
        },
      }),
      'SystemMonitoring',
    );
  }

  getStats() {
    return this.requestStats;
  }
}
