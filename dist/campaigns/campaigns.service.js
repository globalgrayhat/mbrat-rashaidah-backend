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
exports.CampaignsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const campaign_entity_1 = require("./entities/campaign.entity");
const campaignStatus_constant_1 = require("../common/constants/campaignStatus.constant");
const user_entity_1 = require("../user/entities/user.entity");
let CampaignsService = class CampaignsService {
    campaignRepo;
    userRepo;
    constructor(campaignRepo, userRepo) {
        this.campaignRepo = campaignRepo;
        this.userRepo = userRepo;
    }
    async getCampaigns(search, purpose, page, CAMPAIGNS_PER_PAGE) {
        const where = {};
        if (search)
            where.name = (0, typeorm_2.ILike)(`%${search.trim().toLowerCase()}%`);
        if (purpose)
            where.purpose = purpose;
        const CampaignsCount = await this.campaignRepo.count({ where });
        const totalPagesCount = Math.ceil(CampaignsCount / CAMPAIGNS_PER_PAGE);
        if (page > totalPagesCount && totalPagesCount > 0) {
            throw new common_1.BadRequestException(`only pages between 1 and ${totalPagesCount} allowed`);
        }
        const campaigns = await this.campaignRepo.find({
            where,
            relations: ['official'],
            select: [
                'id',
                'name',
                'amountRequired',
                'amountLeft',
                'purpose',
                'campaignStatus',
            ],
            skip: (page - 1) * CAMPAIGNS_PER_PAGE,
            take: CAMPAIGNS_PER_PAGE,
        });
        return campaigns;
    }
    async addCampaign(createCampaignDto, userId) {
        const official = await this.userRepo.findOne({ where: { id: userId } });
        if (!official || !official.isVerified) {
            throw new common_1.UnauthorizedException('not verified user');
        }
        try {
            const newCampaign = this.campaignRepo.create({
                ...createCampaignDto,
                officialId: userId,
                amountLeft: createCampaignDto.amountRequired,
                amountRaised: 0,
                campaignStatus: campaignStatus_constant_1.CampaignStatusEnum.ACTIVE,
            });
            await this.campaignRepo.save(newCampaign);
            return newCampaign;
        }
        catch {
            throw new common_1.InternalServerErrorException('Failed to create campaign');
        }
    }
    async getCampaign(id) {
        const campaign = await this.campaignRepo.findOne({
            where: { id },
            relations: ['official'],
        });
        if (!campaign)
            throw new common_1.NotFoundException('Campaign not found');
        return campaign;
    }
    async editCampaign(id, UpdateCampaignDto) {
        const campaign = await this.campaignRepo.findOne({ where: { id } });
        if (!campaign)
            throw new common_1.NotFoundException('Campaign not found');
        Object.assign(campaign, UpdateCampaignDto);
        await this.campaignRepo.save(campaign);
        return campaign;
    }
    async deleteCampaign(id) {
        const campaign = await this.campaignRepo.findOne({
            where: { id, campaignStatus: campaignStatus_constant_1.CampaignStatusEnum.COMPLETED },
        });
        if (!campaign) {
            throw new common_1.ForbiddenException('only COMPLETED campaigns are allowed to be deleted');
        }
        await this.campaignRepo.remove(campaign);
        return `Campaign ${campaign.name} was deleted successfully!`;
    }
};
exports.CampaignsService = CampaignsService;
exports.CampaignsService = CampaignsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(campaign_entity_1.Campaign)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], CampaignsService);
//# sourceMappingURL=campaigns.service.js.map