"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const config_service_1 = require("./config/config.service");
const traffic_interceptor_1 = require("./common/interceptors/traffic.interceptor");
const helmet_1 = require("helmet");
const compression = require("compression");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_service_1.AppConfigService);
    const isDev = configService.isDevelopment;
    app.enableCors({
        origin: isDev ? true : configService.allowedOrigins,
        credentials: true,
    });
    app.use((0, helmet_1.default)());
    app.use(compression());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    app.useGlobalInterceptors(app.get(traffic_interceptor_1.TrafficInterceptor));
    await app.listen(configService.port);
    if (isDev) {
        console.log('🧪 Development mode: CORS enabled for any origin');
    }
    const protocol = isDev ? 'http' : 'https';
    console.log(`🚀 ${configService.appName} is running at ${protocol}://${configService.apiDomain}:${configService.port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map