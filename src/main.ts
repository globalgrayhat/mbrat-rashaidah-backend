/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AppConfigService } from './config/config.service';
import { TrafficInterceptor } from './common/interceptors/traffic.interceptor';
import helmet from 'helmet';
import * as compression from 'compression';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
async function bootstrap() {
  // Create the NestJS application with Express platform (for static files)
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Get AppConfigService instance from DI container
  const configService = app.get(AppConfigService);
  const isDev = configService.isDevelopment;

  /* ---------- static files ---------- */
  // ②   <project root>/uploads  ⤏  http://host:port/uploads/*
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads', // URL prefix
    setHeaders(res) {
      // good practice: correct MIME type is set automatically by Express
      // optionally add caching headers here
    },
  });

  // Enable CORS for development or specific origins in production
  app.enableCors({
    origin: isDev ? true : configService.allowedOrigins,
    credentials: true,
  });

  // Apply security headers using helmet
  app.use(helmet());

  // Enable GZIP compression for responses
  app.use(compression());

  // Enable global validation pipe for DTO validation/transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove properties not in DTO
      transform: true, // Automatically transform payloads to DTO instances
      forbidNonWhitelisted: true, // Throw error if unknown fields exist
    }),
  );

  // Apply global traffic interceptor (for logging, metrics, etc.)
  app.useGlobalInterceptors(app.get(TrafficInterceptor));

  // Start the application
  await app.listen(configService.port);

  // Development-specific logs
  if (isDev) {
    console.log('🧪 Development mode: CORS enabled for all origins');
  }

  // Log final API URL
  const protocol = isDev ? 'http' : 'https';
  console.log(
    `🚀 ${configService.appName} is running at ${protocol}://${configService.apiDomain}:${configService.port}`,
  );
}
bootstrap();
