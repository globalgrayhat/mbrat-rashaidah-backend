import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyFatooraService } from './myfatoora.service';
import { Donation } from '../donations/entities/donation.entity';
import { Project } from '../projects/entities/project.entity';

/**
 * Module providing MyFatoora integration services and configuration
 */
@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forFeature([Donation, Project]),
  ],
  providers: [
    /**
     * Configuration provider for MyFatoora integration
     */
    {
      provide: 'MYFATOORA_CONFIG',
      useFactory: (configService: ConfigService) => ({
        baseUrl: configService.get<string>('MYFATOORA_BASE_URL'),
        apiKey: configService.get<string>('MYFATOORA_API_KEY'),
        successUrl: configService.get<string>('MYFATOORA_SUCCESS_URL'),
        errorUrl: configService.get<string>('MYFATOORA_ERROR_URL'),
        webhookSecret: configService.get<string>('MYFATOORA_WEBHOOK_SECRET'),
      }),
      inject: [ConfigService],
    },
    MyFatooraService,
  ],
  exports: [MyFatooraService],
})
export class MyFatooraModule {}
