"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyFatooraModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const myfatoora_service_1 = require("./myfatoora.service");
const donation_entity_1 = require("../donations/entities/donation.entity");
const project_entity_1 = require("../projects/entities/project.entity");
let MyFatooraModule = class MyFatooraModule {
};
exports.MyFatooraModule = MyFatooraModule;
exports.MyFatooraModule = MyFatooraModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forFeature([donation_entity_1.Donation, project_entity_1.Project]),
        ],
        providers: [
            {
                provide: 'MYFATOORA_CONFIG',
                useFactory: (configService) => ({
                    baseUrl: configService.get('MYFATOORA_BASE_URL'),
                    apiKey: configService.get('MYFATOORA_API_KEY'),
                    successUrl: configService.get('MYFATOORA_SUCCESS_URL'),
                    errorUrl: configService.get('MYFATOORA_ERROR_URL'),
                    webhookSecret: configService.get('MYFATOORA_WEBHOOK_SECRET'),
                }),
                inject: [config_1.ConfigService],
            },
            myfatoora_service_1.MyFatooraService,
        ],
        exports: [myfatoora_service_1.MyFatooraService],
    })
], MyFatooraModule);
//# sourceMappingURL=myfatoora.module.js.map