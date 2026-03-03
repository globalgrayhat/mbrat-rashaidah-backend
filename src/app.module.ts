import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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

@Module({
  imports: [
    AppConfigModule,
    CommonPipesModule,
    // Database connection setup using TypeORM and async config loading
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (config: AppConfigService) => ({
        type: config.typeDatabase as 'mysql' | 'mariadb', // Database type (e.g., 'mysql')
        host: config.hostDatabase, // Database host
        port: config.portDatabase, // Database port
        username: config.userDatabase, // Database username
        password: config.passwordDatabase, // Database password
        database: config.nameDatabase, // Database name
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
        ],
        synchronize: config.isDevelopment, // Auto-sync entities (only in development)
        // Optional: SSL configuration if required by the host (e.g., Clever Cloud)
        // ssl: {
        //   rejectUnauthorized: false, // Accept self-signed certificates
        // },
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
  ],

  // Main app controller
  controllers: [AppController],

  // Global providers (services, interceptors, logging)
  providers: [AppService, TrafficInterceptor, CustomLogger, MonitoringService],
})
export class AppModule implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    try {
      const dbName = this.dataSource.driver.database;
      console.log(
        `\n[Auto-Fix] Synchronizing database collations for \`${dbName}\` to utf8mb4_unicode_ci...`,
      );

      await this.dataSource.query('SET FOREIGN_KEY_CHECKS=0;');
      await this.dataSource.query(
        `ALTER DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
      );

      /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
      const tables: any[] = await this.dataSource.query('SHOW TABLES');
      const tableKey = `Tables_in_${String(dbName)}`;

      for (const row of tables) {
        const tableName = String(row[tableKey] || Object.values(row)[0]);
        await this.dataSource.query(
          `ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
        );
      }

      await this.dataSource.query('SET FOREIGN_KEY_CHECKS=1;');
      console.log(
        '[Auto-Fix] Database collations successfully aligned automatically! No mixed collations possible.\n',
      );
    } catch (e) {
      console.error(
        '[Auto-Fix] Error syncing collations:',
        (e as Error).message,
      );
    }
  }
}
