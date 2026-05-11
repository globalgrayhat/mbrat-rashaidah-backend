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
import { DonorModule } from './donor/donor.module';
import { DonationsModule } from './donations/donations.module';
import { PaymentModule } from './payment/payment.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { HomeModule } from './home/home.module';

// Database entity imports
import { User } from './user/entities/user.entity';
import { Banner } from './banners/entities/banner.entity';
import { Project } from './projects/entities/project.entity';
import { Category } from './categories/entities/category.entity';
import { Media } from './media/entities/media.entity';
import { Country } from './countries/entities/country.entity';
import { Continent } from './continents/entities/continent.entity';
import { Campaign } from './campaigns/entities/campaign.entity';
import { Donor } from './donor/entities/donor.entity';
import { Donation } from './donations/entities/donation.entity';

// Common services and interceptors
import { TrafficInterceptor } from './common/interceptors/traffic.interceptor';
import { CustomLogger } from './common/services/logger.service';
import { MonitoringService } from './common/services/monitoring.service';
import { CommonPipesModule } from './common/pipes/pipes.module';
import { Payment } from './payment/entities/payment.entity';
import { OutboxEvent } from './common/outbox/entities/outbox-event.entity';
import { HomeFeedService } from './common/home-feed.service';
import { PaginationModule } from './common/pagination/pagination.module';

@Module({
  imports: [
    AppConfigModule,
    CommonPipesModule,
    PaginationModule,
    // Database connection setup using TypeORM and async config loading
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (config: AppConfigService) => ({
        type: config.typeDatabase as 'mysql' | 'mariadb',
        host: config.hostDatabase,
        port: config.portDatabase,
        username: config.userDatabase,
        password: config.passwordDatabase,
        database: config.nameDatabase,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
        entities: [
          User,
          Banner,
          Project,
          Category,
          Media,
          Country,
          Continent,
          Campaign,
          Donor,
          Donation,
          Payment,
          OutboxEvent,
        ],
        synchronize: !config.isProduction,
        // logging: config.isDevelopment,
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
    DonorModule,
    DonationsModule,
    PaymentModule,
    OutboxModule,
    HomeModule,
  ],

  // Main app controller
  controllers: [AppController],

  // Global providers (services, interceptors, logging)
  providers: [AppService, TrafficInterceptor, CustomLogger, MonitoringService],
})
export class AppModule {
  // Database migrations will now handle schema changes
  // Run: npm run typeorm migration:run to apply pending migrations
}
