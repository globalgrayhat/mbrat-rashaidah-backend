/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { BannersModule } from './banners/banners.module';
import { ProjectsModule } from './projects/projects.module';
import { CategoriesModule } from './categories/categories.module';
import { MediaModule } from './media/media.module';
import { User } from './user/entities/user.entity';
import { Banner } from './banners/entities/banner.entity';
import { Project } from './projects/entities/project.entity';
import { Category } from './categories/entities/category.entity';
import { Media } from './media/entities/media.entity';
import { TrafficInterceptor } from './common/interceptors/traffic.interceptor';
import { CustomLogger } from './common/services/logger.service';
import { MonitoringService } from './common/services/monitoring.service';
import { Country } from './countries/entities/country.entity';
import { CountriesModule } from './countries/countries.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { Continent } from './continents/entities/continent.entity';
import { ContinentsModule } from './continents/continents.module';
import { Campaign } from './campaigns/entities/campaign.entity';
import { Donation } from './donations/entities/donation.entity';
import { DonationsModule } from './donations/donations.module';
import { MyFatooraModule } from './myfatoora/myfatoora.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (config: AppConfigService) => ({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        type: config.type as any,
        host: config.host,
        port: config.port,
        username: config.user,
        password: config.password,
        database: config.database,
        entities: [
          User,
          Banner,
          Project,
          Category,
          Media,
          Country,
          Continent,
          Campaign,
          Donation,
        ],
        synchronize: config.isDevelopment,
      }),
      inject: [AppConfigService],
    }),
    AuthModule,
    UserModule,
    AdminModule,
    BannersModule,
    ProjectsModule,
    CategoriesModule,
    MediaModule,
    CountriesModule,
    ContinentsModule,
    CampaignsModule,
    DonationsModule,
    MyFatooraModule,
    StripeModule,
  ],
  providers: [TrafficInterceptor, CustomLogger, MonitoringService],
})
export class AppModule {}
