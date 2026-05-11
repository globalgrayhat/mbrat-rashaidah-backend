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
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // Create the NestJS application with Express platform (for static files)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Get AppConfigService instance from DI container
  const configService = app.get(AppConfigService);
  const isDev = configService.isDevelopment;

  /* ---------- static files ---------- */
  // ②   <project root>/uploads  ⤏  http://host:port/uploads/*
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads', // URL prefix
    setHeaders() {
      // good practice: correct MIME type is set automatically by Express
      // optionally add caching headers here
    },
  });

  // Enable CORS for development or specific origins in production
  app.enableCors({
    // origin: isDev ? true : configService.allowedOrigins,
    credentials: true,
  });

  // Apply security headers using helmet
  app.use(helmet());

  // Enable GZIP compression for responses
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(compression());

  // Enable global validation pipe for DTO validation/transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove properties not in DTO
      transform: true, // Automatically transform payloads to DTO instances
      forbidNonWhitelisted: false, // Don't throw error if unknown fields exist to avoid breaking existing clients during refactor
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Configure Swagger/OpenAPI documentation
  const protocol = isDev ? 'http' : 'https';
  const apiUrl = `${protocol}://${configService.apiDomain}:${configService.port}`;
  
  const config = new DocumentBuilder()
    .setTitle('MBRAT Rashaidah API')
    .setDescription('The MBRAT Rashaidah Backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  console.log(`Swagger is running at http://localhost:${configService.port}/api/docs`);

  // Apply global traffic interceptor (for logging, metrics, etc.)
  app.useGlobalInterceptors(app.get(TrafficInterceptor));

  // Start the application
  await app.listen(configService.port);

  // Development-specific logs
  if (isDev) {
    console.log('🧪 Development mode: CORS enabled for all origins');
  }

  // Log final API URL
  console.log(
    `🚀 ${configService.appName} is running at ${protocol}://localhost:${configService.port}`,
  );
}
bootstrap();
