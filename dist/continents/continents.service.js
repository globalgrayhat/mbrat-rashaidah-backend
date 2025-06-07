"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const continent_entity_1 = require("./entities/continent.entity");
let ContinentsService = class ContinentsService {
    continentRepository;
    constructor(continentRepository) {
        this.continentRepository = continentRepository;
    }
    async create(createContinentDto) {
        const continent = this.continentRepository.create(createContinentDto);
        return this.continentRepository.save(continent);
    }
    async findAll() {
        return this.continentRepository.find();
    }
    async findOne(id) {
        return this.continentRepository.findOne({ where: { id: id } });
    }
    async update(id, updateContinentDto) {
        return this.continentRepository.update(id, updateContinentDto);
    }
    async remove(id) {
        return this.continentRepository.delete(id);
    }
};
exports.ContinentsService = ContinentsService;
exports.ContinentsService = ContinentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(continent_entity_1.Continent)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ContinentsService);
//# sourceMappingURL=continents.service.js.map