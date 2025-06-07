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
exports.AppConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let AppConfigService = class AppConfigService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    get appName() {
        return this.configService.get('APP_NAME') ?? 'GlobalGrayHat';
    }
    get port() {
        return Number(this.configService.get('PORT') ?? 3000);
    }
    get baseDomain() {
        return this.configService.get('BASE_DOMAIN') ?? 'localhost';
    }
    get apiDomain() {
        return (this.configService.get('API_DOMAIN') ?? `api.${this.baseDomain}`);
    }
    get allowedOrigins() {
        const rawOrigins = this.configService.get('ALLOWED_ORIGINS');
        const origins = rawOrigins
            ? rawOrigins.split(',').map((origin) => origin.trim())
            : [];
        const base = `https://${this.baseDomain}`;
        const api = `https://${this.apiDomain}`;
        if (!origins.includes(base)) {
            origins.push(base);
        }
        if (!origins.includes(api)) {
            origins.push(api);
        }
        return origins;
    }
    get isDevelopment() {
        return this.configService.get('NODE_ENV') === 'development';
    }
    get isTest() {
        return this.configService.get('NODE_ENV') === 'test';
    }
    get isProduction() {
        return this.configService.get('NODE_ENV') === 'production';
    }
    get typeDatabase() {
        return this.configService.get('TYPE_DATABASE') || '';
    }
    get hostDatabase() {
        return this.configService.get('HOST_DATABASE') || '';
    }
    get portDatabase() {
        return this.configService.get('PORT_DATABASE') || 3306;
    }
    get userDatabase() {
        return this.configService.get('USER_DATABASE') || '';
    }
    get passwordDatabase() {
        return this.configService.get('PASSWORD_DATABASE') || '';
    }
    get nameDatabase() {
        return this.configService.get('NAME_DATABASE') || '';
    }
    get jwtAccessTokenSecret() {
        return this.configService.get('JWT_ACCESS_SECRET') || '';
    }
    get jwtAccessTokenExpiresIn() {
        return this.configService.get('JWT_EXPIRATION') || '';
    }
    get jwtRefreshTokenSecret() {
        return this.configService.get('JWT_REFRESH_SECRET') || '';
    }
    get jwtRefreshTokenExpiresIn() {
        return this.configService.get('JWT_REFRESH_EXPIRATION') || '';
    }
    get otpEnabled() {
        return this.configService.get('OTP_ENABLED', 'false') === 'true';
    }
    get otpExpiresIn() {
        return this.configService.get('EXP_MINUTES', 1);
    }
    get otpLength() {
        return this.configService.get('OTP_LENGTH', 6);
    }
    get mailHost() {
        return this.configService.get('MAIL_HOST', '');
    }
    get mailPort() {
        return Number(this.configService.get('MAIL_PORT', 465));
    }
    get mailSecure() {
        return this.configService.get('MAIL_SECURE', 'SSL');
    }
    get mailUser() {
        return this.configService.get('MAIL_USER', '');
    }
    get mailPass() {
        return this.configService.get('MAIL_PASS', '');
    }
    get mailFrom() {
        return this.configService.get('MAIL_FROM', '');
    }
    get mailFromName() {
        return this.configService.get('MAIL_FROM_NAME', 'No‑Reply');
    }
};
exports.AppConfigService = AppConfigService;
exports.AppConfigService = AppConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AppConfigService);
//# sourceMappingURL=config.service.js.map