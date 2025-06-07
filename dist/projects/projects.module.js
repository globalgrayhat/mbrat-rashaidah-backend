"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const projects_service_1 = require("./projects.service");
const projects_controller_1 = require("./projects.controller");
const project_entity_1 = require("./entities/project.entity");
const categories_module_1 = require("../categories/categories.module");
const countries_module_1 = require("../countries/countries.module");
const continents_module_1 = require("../continents/continents.module");
const media_module_1 = require("../media/media.module");
const category_entity_1 = require("../categories/entities/category.entity");
const country_entity_1 = require("../countries/entities/country.entity");
const continent_entity_1 = require("../continents/entities/continent.entity");
const media_entity_1 = require("../media/entities/media.entity");
let ProjectsModule = class ProjectsModule {
};
exports.ProjectsModule = ProjectsModule;
exports.ProjectsModule = ProjectsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([project_entity_1.Project, category_entity_1.Category, country_entity_1.Country, continent_entity_1.Continent, media_entity_1.Media]),
            categories_module_1.CategoriesModule,
            countries_module_1.CountriesModule,
            continents_module_1.ContinentsModule,
            media_module_1.MediaModule,
        ],
        controllers: [projects_controller_1.ProjectsController],
        providers: [projects_service_1.ProjectsService],
        exports: [projects_service_1.ProjectsService, typeorm_1.TypeOrmModule],
    })
], ProjectsModule);
//# sourceMappingURL=projects.module.js.map