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
exports.TrafficInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const logger_service_1 = require("../services/logger.service");
const monitoring_service_1 = require("../services/monitoring.service");
let TrafficInterceptor = class TrafficInterceptor {
    logger;
    monitoringService;
    constructor(logger, monitoringService) {
        this.logger = logger;
        this.monitoringService = monitoringService;
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const now = Date.now();
        const { ip = '', originalUrl = '', headers = {}, method = '' } = request;
        this.logger.log(`Incoming ${method} ${originalUrl}`, 'TrafficInterceptor');
        const contentLength = headers['content-length']
            ? parseInt(Array.isArray(headers['content-length'])
                ? headers['content-length'][0]
                : headers['content-length'], 10)
            : 0;
        if (contentLength > 1024 * 1024) {
            this.logger.warn(`Large request detected: ${method} ${originalUrl} (${Math.round(contentLength / 1024)}KB)`, 'TrafficMonitoring');
        }
        return next.handle().pipe((0, operators_1.tap)(() => {
            const statusCode = context
                .switchToHttp()
                .getResponse().statusCode;
            const responseTime = Date.now() - now;
            this.monitoringService.trackRequest(method, originalUrl, responseTime, statusCode);
            this.logger.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                method,
                url: originalUrl,
                ip,
                userAgent: headers['user-agent'],
                requestSize: contentLength,
                responseTime: `${responseTime}ms`,
                statusCode,
            }), 'TrafficMonitoring');
            if (responseTime > 1000) {
                this.logger.warn(`Slow response detected: ${method} ${originalUrl} took ${responseTime}ms`, 'TrafficMonitoring');
            }
        }));
    }
};
exports.TrafficInterceptor = TrafficInterceptor;
exports.TrafficInterceptor = TrafficInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.CustomLogger,
        monitoring_service_1.MonitoringService])
], TrafficInterceptor);
//# sourceMappingURL=traffic.interceptor.js.map