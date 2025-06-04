import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyFatooraService } from './myfatoora.service';
import { MyFatooraController } from './myfatoora.controller';
import { Donation } from '../donations/entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    ConfigModule,
    ProjectsModule,
    TypeOrmModule.forFeature([Donation, Project]),
  ],
  controllers: [MyFatooraController],
  providers: [
    {
      provide: 'MYFATOORAH_CONFIG',
      useFactory: (configService: ConfigService) => ({
        apiKey: configService.get<string>('MYFATOORAH_API_KEY'),
        baseUrl: configService.get<string>('MYFATOORAH_BASE_URL'),
        successUrl: configService.get<string>('MYFATOORAH_SUCCESS_URL'),
        errorUrl: configService.get<string>('MYFATOORAH_ERROR_URL'),
        webhookSecret: configService.get<string>('MYFATOORAH_WEBHOOK_SECRET'),
      }),
      inject: [ConfigService],
    },
    MyFatooraService,
  ],
  exports: [MyFatooraService],
})
export class MyFatooraModule {}
