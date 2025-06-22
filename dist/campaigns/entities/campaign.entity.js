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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Campaign = void 0;
const typeorm_1 = require("typeorm");
const project_entity_1 = require("../../projects/entities/project.entity");
const user_entity_1 = require("../../user/entities/user.entity");
const campaignPurpose_constant_1 = require("../../common/constants/campaignPurpose.constant");
const campaignStatus_constant_1 = require("../../common/constants/campaignStatus.constant");
let Campaign = class Campaign {
    id;
    name;
    description;
    amountRequired;
    amountRaised;
    amountLeft;
    purpose;
    campaignStatus;
    official;
    officialId;
    project;
    projectId;
    createdAt;
    updatedAt;
};
exports.Campaign = Campaign;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Campaign.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true, length: 255 }),
    __metadata("design:type", String)
], Campaign.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Campaign.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Campaign.prototype, "amountRequired", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Campaign.prototype, "amountRaised", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Campaign.prototype, "amountLeft", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: campaignPurpose_constant_1.CampaignPurposeEnum,
    }),
    __metadata("design:type", String)
], Campaign.prototype, "purpose", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: campaignStatus_constant_1.CampaignStatusEnum,
        default: campaignStatus_constant_1.CampaignStatusEnum.ACTIVE,
    }),
    __metadata("design:type", String)
], Campaign.prototype, "campaignStatus", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: false, eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'officialId' }),
    __metadata("design:type", user_entity_1.User)
], Campaign.prototype, "official", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], Campaign.prototype, "officialId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => project_entity_1.Project, { nullable: true, eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'projectId' }),
    __metadata("design:type", project_entity_1.Project)
], Campaign.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { nullable: true }),
    __metadata("design:type", String)
], Campaign.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], Campaign.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], Campaign.prototype, "updatedAt", void 0);
exports.Campaign = Campaign = __decorate([
    (0, typeorm_1.Entity)('campaigns')
], Campaign);
//# sourceMappingURL=campaign.entity.js.map