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
exports.CampaignsController = void 0;
const common_1 = require("@nestjs/common");
const campaigns_service_1 = require("./campaigns.service");
const createCampaignDto_1 = require("./dto/createCampaignDto");
const campaignExists_pipe_1 = require("../common/pipes/campaignExists.pipe");
const UpdateCampaignDto_1 = require("./dto/UpdateCampaignDto");
const campaignPurpose_constant_1 = require("../common/constants/campaignPurpose.constant");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_constant_1 = require("../common/constants/roles.constant");
let CampaignsController = class CampaignsController {
    campaignsService;
    constructor(campaignsService) {
        this.campaignsService = campaignsService;
    }
    getCampaigns(page, purpose, search) {
        const CAMPAIGNS_PER_PAGE = 5;
        return this.campaignsService.getCampaigns(search, purpose, page, CAMPAIGNS_PER_PAGE);
    }
    addCampaign(req, createCampaignDto) {
        const userId = req.user.userId;
        return this.campaignsService.addCampaign(createCampaignDto, userId);
    }
    getCampaign(id) {
        return this.campaignsService.getCampaign(id);
    }
    editCampaign(id, UpdateCampaignDto) {
        return this.campaignsService.editCampaign(id, UpdateCampaignDto);
    }
    deleteCampaign(id) {
        return this.campaignsService.deleteCampaign(id);
    }
};
exports.CampaignsController = CampaignsController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(roles_constant_1.Role.SUPER_ADMIN, roles_constant_1.Role.ADMIN),
    __param(0, (0, common_1.Query)('page', new common_1.DefaultValuePipe(1), common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('purpose', new common_1.ParseEnumPipe(campaignPurpose_constant_1.CampaignPurposeEnum, {
        optional: true,
    }))),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", void 0)
], CampaignsController.prototype, "getCampaigns", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(roles_constant_1.Role.SUPER_ADMIN, roles_constant_1.Role.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, createCampaignDto_1.CreateCampaignDto]),
    __metadata("design:returntype", void 0)
], CampaignsController.prototype, "addCampaign", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UsePipes)(campaignExists_pipe_1.campaignExistsPipe),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CampaignsController.prototype, "getCampaign", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(roles_constant_1.Role.SUPER_ADMIN, roles_constant_1.Role.ADMIN),
    (0, common_1.UsePipes)(campaignExists_pipe_1.campaignExistsPipe),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateCampaignDto_1.UpdateCampaignDto]),
    __metadata("design:returntype", void 0)
], CampaignsController.prototype, "editCampaign", null);
__decorate([
    (0, roles_decorator_1.Roles)(roles_constant_1.Role.SUPER_ADMIN, roles_constant_1.Role.ADMIN),
    (0, common_1.Delete)(':id'),
    (0, common_1.UsePipes)(campaignExists_pipe_1.campaignExistsPipe),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CampaignsController.prototype, "deleteCampaign", null);
exports.CampaignsController = CampaignsController = __decorate([
    (0, common_1.Controller)('campaigns'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [campaigns_service_1.CampaignsService])
], CampaignsController);
//# sourceMappingURL=campaigns.controller.js.map