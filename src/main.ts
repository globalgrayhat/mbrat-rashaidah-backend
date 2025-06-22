/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AppConfigService } from './config/config.service';
import { TrafficInterceptor } from './common/interceptors/traffic.interceptor';
import helmet from 'helmet';
import * as compression from 'compression';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Get config service
  const configService = app.get(AppConfigService);
  const isDev = configService.isDevelopment;

  // Enable CORS with allowed origins from config
  app.enableCors({
    origin: isDev ? true : configService.allowedOrigins,
    credentials: true,
  });

  // Security middleware
  app.use(helmet()); // This should now be callable
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(compression());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // Global traffic interceptor
  app.useGlobalInterceptors(app.get(TrafficInterceptor));

  // In development mode, allow all origins for easier testing and log a notice
  if (isDev) {
    console.log('🧪 Development mode: CORS enabled for any origin');
  }

  // Determine the protocol based on the environment
  const protocol = isDev ? 'http' : 'https';

  // Log application startup message with full API URL
  console.log(
    `🚀 ${configService.appName} is running at ${protocol}://${configService.apiDomain}:${configService.port}`,
  );

  // Instead of using `app.listen(configService.port)`, use a handler for Vercel
  return app.getHttpAdapter().getInstance(); // Return the HTTP instance to handle the serverless request.
}

// Handler for Vercel to handle serverless function
export default async (req: VercelRequest, res: VercelResponse) => {
  const server = await bootstrap();
  server(req, res); // Handle the request with the server instance
};
