"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_module_1 = require("./config/config.module");
const config_service_1 = require("./config/config.service");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("./auth/auth.module");
const user_module_1 = require("./user/user.module");
const admin_module_1 = require("./admin/admin.module");
const banners_module_1 = require("./banners/banners.module");
const projects_module_1 = require("./projects/projects.module");
const categories_module_1 = require("./categories/categories.module");
const media_module_1 = require("./media/media.module");
const countries_module_1 = require("./countries/countries.module");
const continents_module_1 = require("./continents/continents.module");
const campaigns_module_1 = require("./campaigns/campaigns.module");
const donations_module_1 = require("./donations/donations.module");
const myfatoora_module_1 = require("./myfatoora/myfatoora.module");
const stripe_module_1 = require("./stripe/stripe.module");
const user_entity_1 = require("./user/entities/user.entity");
const banner_entity_1 = require("./banners/entities/banner.entity");
const project_entity_1 = require("./projects/entities/project.entity");
const category_entity_1 = require("./categories/entities/category.entity");
const media_entity_1 = require("./media/entities/media.entity");
const country_entity_1 = require("./countries/entities/country.entity");
const continent_entity_1 = require("./continents/entities/continent.entity");
const campaign_entity_1 = require("./campaigns/entities/campaign.entity");
const donation_entity_1 = require("./donations/entities/donation.entity");
const traffic_interceptor_1 = require("./common/interceptors/traffic.interceptor");
const logger_service_1 = require("./common/services/logger.service");
const monitoring_service_1 = require("./common/services/monitoring.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_module_1.AppConfigModule,
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_module_1.AppConfigModule],
                useFactory: (config) => ({
                    type: config.typeDatabase,
                    host: config.hostDatabase,
                    port: config.portDatabase,
                    username: config.userDatabase,
                    password: config.passwordDatabase,
                    database: config.nameDatabase,
                    entities: [
                        user_entity_1.User,
                        banner_entity_1.Banner,
                        project_entity_1.Project,
                        category_entity_1.Category,
                        media_entity_1.Media,
                        country_entity_1.Country,
                        continent_entity_1.Continent,
                        campaign_entity_1.Campaign,
                        donation_entity_1.Donation,
                    ],
                    synchronize: config.isDevelopment,
                    ssl: {
                        rejectUnauthorized: false,
                    },
                }),
                inject: [config_service_1.AppConfigService],
            }),
            auth_module_1.AuthModule,
            user_module_1.UserModule,
            admin_module_1.AdminModule,
            banners_module_1.BannersModule,
            projects_module_1.ProjectsModule,
            categories_module_1.CategoriesModule,
            media_module_1.MediaModule,
            countries_module_1.CountriesModule,
            continents_module_1.ContinentsModule,
            campaigns_module_1.CampaignsModule,
            donations_module_1.DonationsModule,
            myfatoora_module_1.MyFatooraModule,
            stripe_module_1.StripeModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService, traffic_interceptor_1.TrafficInterceptor, logger_service_1.CustomLogger, monitoring_service_1.MonitoringService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map