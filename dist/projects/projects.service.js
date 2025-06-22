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
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const project_entity_1 = require("./entities/project.entity");
const category_entity_1 = require("../categories/entities/category.entity");
const country_entity_1 = require("../countries/entities/country.entity");
const continent_entity_1 = require("../continents/entities/continent.entity");
const media_entity_1 = require("../media/entities/media.entity");
const project_constant_1 = require("../common/constants/project.constant");
let ProjectsService = class ProjectsService {
    projectRepository;
    categoryRepository;
    countryRepository;
    continentRepository;
    mediaRepository;
    constructor(projectRepository, categoryRepository, countryRepository, continentRepository, mediaRepository) {
        this.projectRepository = projectRepository;
        this.categoryRepository = categoryRepository;
        this.countryRepository = countryRepository;
        this.continentRepository = continentRepository;
        this.mediaRepository = mediaRepository;
    }
    async ensureEntityExists(repo, id, entityName) {
        const entity = await repo.findOne({ where: { id: id } });
        if (!entity) {
            throw new common_1.NotFoundException(`${entityName} with ID "${id}" not found.`);
        }
        return entity;
    }
    async ensureSlugUnique(slug) {
        const existing = await this.projectRepository.findOne({ where: { slug } });
        if (existing) {
            throw new common_1.ConflictException(`Slug "${slug}" is already in use.`);
        }
    }
    async create(createProjectDto) {
        const { title, slug, categoryId, countryId, continentId, mediaIds = [], } = createProjectDto;
        const existingBySlug = await this.projectRepository.findOne({
            where: { slug },
        });
        if (existingBySlug) {
            throw new common_1.ConflictException(`Slug "${slug}" is already in use.`);
        }
        const category = await this.categoryRepository.findOne({
            where: { id: categoryId },
        });
        if (!category) {
            throw new common_1.NotFoundException(`Category with ID "${categoryId}" not found.`);
        }
        const country = await this.countryRepository.findOne({
            where: { id: countryId },
        });
        if (!country) {
            throw new common_1.NotFoundException(`Country with ID "${countryId}" not found.`);
        }
        const continent = await this.continentRepository.findOne({
            where: { id: continentId },
        });
        if (!continent) {
            throw new common_1.NotFoundException(`Continent with ID "${continentId}" not found.`);
        }
        const project = this.projectRepository.create({
            title,
            slug,
            description: createProjectDto.description,
            location: createProjectDto.location,
            startDate: createProjectDto.startDate,
            endDate: createProjectDto.endDate,
            targetAmount: createProjectDto.targetAmount,
            currentAmount: createProjectDto.currentAmount,
            categoryId,
            countryId,
            continentId,
            status: project_constant_1.ProjectStatus.DRAFT,
            isActive: createProjectDto.isActive ?? true,
            isDonationActive: createProjectDto.isDonationActive ?? false,
            isProgressActive: createProjectDto.isProgressActive ?? false,
            isTargetAmountActive: createProjectDto.isTargetAmountActive ?? false,
            donationGoal: createProjectDto.donationGoal,
        });
        if (mediaIds.length > 0) {
            const medias = await this.mediaRepository.findByIds(mediaIds);
            if (medias.length !== mediaIds.length) {
                throw new common_1.NotFoundException(`One or more media items not found.`);
            }
            project.media = medias;
        }
        try {
            return await this.projectRepository.save(project);
        }
        catch (err) {
            if (err instanceof typeorm_2.QueryFailedError && err.code === '23505') {
                throw new common_1.ConflictException(`Project slug "${slug}" already exists.`);
            }
            throw err;
        }
    }
    async findAll() {
        return this.projectRepository.find({
            relations: ['category', 'country', 'continent', 'media'],
            order: {
                createdAt: 'DESC',
            },
        });
    }
    async findOne(id) {
        const project = await this.projectRepository.findOne({
            where: { id },
            relations: ['category', 'country', 'continent', 'media'],
        });
        if (!project) {
            throw new common_1.NotFoundException(`Project with ID "${id}" not found.`);
        }
        return project;
    }
    async update(id, updateProjectDto) {
        const project = await this.findOne(id);
        if (updateProjectDto.slug && updateProjectDto.slug !== project.slug) {
            await this.ensureSlugUnique(updateProjectDto.slug);
        }
        if (updateProjectDto.categoryId) {
            await this.ensureEntityExists(this.categoryRepository, updateProjectDto.categoryId, 'Category');
        }
        if (updateProjectDto.countryId) {
            await this.ensureEntityExists(this.countryRepository, updateProjectDto.countryId, 'Country');
        }
        if (updateProjectDto.continentId) {
            await this.ensureEntityExists(this.continentRepository, updateProjectDto.continentId, 'Continent');
        }
        Object.assign(project, updateProjectDto);
        if (updateProjectDto.mediaIds) {
            const medias = await this.mediaRepository.findByIds(updateProjectDto.mediaIds);
            const foundIds = medias.map((m) => m.id);
            const missingIds = updateProjectDto.mediaIds.filter((id) => !foundIds.includes(id));
            if (missingIds.length > 0) {
                throw new common_1.NotFoundException(`Media items not found: ${missingIds.join(', ')}`);
            }
            project.media = medias;
        }
        try {
            return await this.projectRepository.save(project);
        }
        catch (err) {
            if (err instanceof typeorm_2.QueryFailedError && err.code === '23505') {
                throw new common_1.ConflictException(`Project slug "${updateProjectDto.slug}" already exists.`);
            }
            throw err;
        }
    }
    async remove(id) {
        const result = await this.projectRepository.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`Project with ID "${id}" not found.`);
        }
    }
    async findByCategory(categoryId) {
        return this.projectRepository.find({
            where: { categoryId },
            relations: ['category', 'country', 'continent', 'media'],
            order: { createdAt: 'DESC' },
        });
    }
    async findByCountry(countryId) {
        return this.projectRepository.find({
            where: { countryId },
            relations: ['category', 'country', 'continent', 'media'],
            order: { createdAt: 'DESC' },
        });
    }
    async findProjectList(status) {
        return this.projectRepository.find({
            where: { status },
            relations: ['category', 'country', 'continent', 'media'],
            order: { createdAt: 'DESC' },
        });
    }
    async findProjectDetails(projectId) {
        const project = await this.projectRepository.findOne({
            where: { id: projectId },
            relations: ['category', 'country', 'continent', 'media'],
        });
        if (!project) {
            throw new common_1.NotFoundException(`Project with ID "${projectId}" not found.`);
        }
        return project;
    }
    async getProjectStats() {
        const [total, active, byCategory, byCountry] = await Promise.all([
            this.projectRepository.count(),
            this.projectRepository.count({ where: { isActive: true } }),
            this.projectRepository
                .createQueryBuilder('project')
                .select('project.categoryId', 'categoryId')
                .addSelect('COUNT(*)', 'count')
                .groupBy('project.categoryId')
                .getRawMany(),
            this.projectRepository
                .createQueryBuilder('project')
                .select('project.countryId', 'countryId')
                .addSelect('COUNT(*)', 'count')
                .groupBy('project.countryId')
                .getRawMany(),
        ]);
        return {
            total,
            active,
            byCategory,
            byCountry,
        };
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __param(1, (0, typeorm_1.InjectRepository)(category_entity_1.Category)),
    __param(2, (0, typeorm_1.InjectRepository)(country_entity_1.Country)),
    __param(3, (0, typeorm_1.InjectRepository)(continent_entity_1.Continent)),
    __param(4, (0, typeorm_1.InjectRepository)(media_entity_1.Media)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map