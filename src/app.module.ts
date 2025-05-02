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
import { Sacrifice } from './sacrifices/sacrifice.entity';
import { SacrificePrice } from './sacrifices/sacrifices-prices/entities/sacrifice-price.entity';
import { SacrificeType } from './sacrifices/sacrifices-types/entities/sacrifice-type.entity';
import { TrafficInterceptor } from './common/interceptors/traffic.interceptor';
import { CustomLogger } from './common/services/logger.service';
import { MonitoringService } from './common/services/monitoring.service';
import { SacrificesModule } from './sacrifices/sacrifices.module';
import { Country } from './countries/entities/country.entity';
import { CountriesModule } from './countries/countries.module';
import { Continent } from './continents/entities/continent.entity';
import { ContinentsModule } from './continents/continents.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (config) => ({
        type: 'postgres',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        host: config.postgresHost,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        port: config.postgresPort,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        username: config.postgresUser,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        password: config.postgresPassword,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        database: config.postgresDatabase,
        entities: [
          User,
          Banner,
          Project,
          Category,
          Media,
          Sacrifice,
          SacrificePrice,
          SacrificeType,
          Country,
          Continent,
        ],
        synchronize: true,
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
    SacrificesModule,
    CountriesModule,
    ContinentsModule,
  ],
  providers: [TrafficInterceptor, CustomLogger, MonitoringService],
})
export class AppModule {}
