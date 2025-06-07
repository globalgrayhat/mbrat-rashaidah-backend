"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("./logger.service");
let MonitoringService = class MonitoringService {
    logger;
    requestStats = {
        totalRequests: 0,
        errorCount: 0,
        endpoints: {},
        responseTimeAvg: 0,
        totalResponseTime: 0,
    };
    constructor(logger) {
        this.logger = logger;
    }
    trackRequest(method, endpoint, responseTime, statusCode) {
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
        if (this.requestStats.totalRequests % 100 === 0) {
            this.logStats();
        }
    }
    logStats() {
        this.logger.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            stats: {
                totalRequests: this.requestStats.totalRequests,
                errorRate: (this.requestStats.errorCount / this.requestStats.totalRequests) *
                    100,
                avgResponseTime: Math.round(this.requestStats.responseTimeAvg),
                topEndpoints: Object.entries(this.requestStats.endpoints)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5),
            },
        }), 'SystemMonitoring');
    }
    getStats() {
        return this.requestStats;
    }
};
exports.MonitoringService = MonitoringService;
exports.MonitoringService = MonitoringService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.CustomLogger])
], MonitoringService);
//# sourceMappingURL=monitoring.service.js.map