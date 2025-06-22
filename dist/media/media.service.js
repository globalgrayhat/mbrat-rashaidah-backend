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
exports.MediaService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const media_entity_1 = require("./entities/media.entity");
let MediaService = class MediaService {
    mediaRepository;
    constructor(mediaRepository) {
        this.mediaRepository = mediaRepository;
    }
    async create(createMediaDto) {
        const media = this.mediaRepository.create({
            ...createMediaDto,
            isActive: createMediaDto.isActive ?? true,
            displayOrder: createMediaDto.displayOrder ?? 0,
        });
        return await this.mediaRepository.save(media);
    }
    async findAll() {
        return await this.mediaRepository.find({
            order: {
                displayOrder: 'ASC',
                createdAt: 'DESC',
            },
        });
    }
    async findOne(id) {
        const media = await this.mediaRepository.findOne({ where: { id } });
        if (!media) {
            throw new common_1.NotFoundException(`Media with ID ${id} not found`);
        }
        return media;
    }
    async update(id, updateMediaDto) {
        const media = await this.findOne(id);
        Object.assign(media, updateMediaDto);
        return await this.mediaRepository.save(media);
    }
    async remove(id) {
        const media = await this.findOne(id);
        await this.mediaRepository.remove(media);
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(media_entity_1.Media)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MediaService);
//# sourceMappingURL=media.service.js.map