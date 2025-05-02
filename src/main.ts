import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TrafficInterceptor } from './common/interceptors/traffic.interceptor';
import helmet from 'helmet'; // Corrected import
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Enable CORS
  app.enableCors();

  // Security middleware
  app.use(helmet()); // This should now be callable
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
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
//
