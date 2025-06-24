/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// App configuration modules
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';

// Core app components
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { BannersModule } from './banners/banners.module';
import { ProjectsModule } from './projects/projects.module';
import { CategoriesModule } from './categories/categories.module';
import { MediaModule } from './media/media.module';
import { CountriesModule } from './countries/countries.module';
import { ContinentsModule } from './continents/continents.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { DonationsModule } from './donations/donations.module';
import { MyFatooraModule } from './myfatoora/myfatoora.module';
import { StripeModule } from './stripe/stripe.module';

// Database entity imports
import { User } from './user/entities/user.entity';
import { Banner } from './banners/entities/banner.entity';
import { Project } from './projects/entities/project.entity';
import { Category } from './categories/entities/category.entity';
import { Media } from './media/entities/media.entity';
import { Country } from './countries/entities/country.entity';
import { Continent } from './continents/entities/continent.entity';
import { Campaign } from './campaigns/entities/campaign.entity';
import { Donation } from './donations/entities/donation.entity';

// Common services and interceptors
import { TrafficInterceptor } from './common/interceptors/traffic.interceptor';
import { CustomLogger } from './common/services/logger.service';
import { MonitoringService } from './common/services/monitoring.service';

@Module({
  imports: [
    AppConfigModule,

    // Database connection setup using TypeORM and async config loading
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (config: AppConfigService) => ({
        type: config.typeDatabase as any, // Database type (e.g., 'mysql')
        host: config.hostDatabase, // Database host
        port: config.portDatabase, // Database port
        username: config.userDatabase, // Database username
        password: config.passwordDatabase, // Database password
        database: config.nameDatabase, // Database name
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
        synchronize: config.isDevelopment, // Auto-sync entities (only in development)

        // Optional: SSL configuration if required by the host (e.g., Clever Cloud)
        ssl: {
          rejectUnauthorized: false, // Accept self-signed certificates
        },
      }),
      inject: [AppConfigService], // Inject AppConfigService to access environment configs
    }),

    // Import feature modules
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

  // Main app controller
  controllers: [AppController],

  // Global providers (services, interceptors, logging)
  providers: [AppService, TrafficInterceptor, CustomLogger, MonitoringService],
})
export class AppModule {}
