"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeModule = void 0;
const common_1 = require("@nestjs/common");
const stripe_controller_1 = require("./stripe.controller");
const stripe_service_1 = require("./stripe.service");
const typeorm_1 = require("@nestjs/typeorm");
const donation_entity_1 = require("../donations/entities/donation.entity");
const project_entity_1 = require("../projects/entities/project.entity");
const config_1 = require("@nestjs/config");
const projects_module_1 = require("../projects/projects.module");
let StripeModule = class StripeModule {
};
exports.StripeModule = StripeModule;
exports.StripeModule = StripeModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            projects_module_1.ProjectsModule,
            typeorm_1.TypeOrmModule.forFeature([donation_entity_1.Donation, project_entity_1.Project]),
        ],
        controllers: [stripe_controller_1.StripeController],
        providers: [stripe_service_1.StripeService],
        exports: [stripe_service_1.StripeService],
    })
], StripeModule);
//# sourceMappingURL=stripe.module.js.map