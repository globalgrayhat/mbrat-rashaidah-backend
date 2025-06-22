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
exports.DonationsController = void 0;
const common_1 = require("@nestjs/common");
const donations_service_1 = require("./donations.service");
const create_donation_dto_1 = require("./dto/create-donation.dto");
const campaignExists_pipe_1 = require("../common/pipes/campaignExists.pipe");
const donationExists_pipe_1 = require("../common/pipes/donationExists.pipe");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_constant_1 = require("../common/constants/roles.constant");
const payment_constant_1 = require("../common/constants/payment.constant");
let DonationsController = class DonationsController {
    donationsService;
    constructor(donationsService) {
        this.donationsService = donationsService;
    }
    async findByProject(projectId) {
        return this.donationsService.findByProject(projectId);
    }
    async create(projectId, createDonationDto) {
        const donation = await this.donationsService.create({
            ...createDonationDto,
            projectId,
        });
        return donation;
    }
    findOne(id) {
        return this.donationsService.findOne(id);
    }
    remove(id) {
        return this.donationsService.remove(id);
    }
    async handleStripeWebhook(event, type) {
        try {
            if (type === 'checkout.session.completed') {
                await this.donationsService.handlePaymentWebhook(payment_constant_1.PaymentMethodEnum.STRIPE, event);
            }
            else if (type === 'payment_intent.payment_failed') {
                await this.donationsService.handlePaymentWebhook(payment_constant_1.PaymentMethodEnum.STRIPE, event);
            }
            return { received: true };
        }
        catch (err) {
            if (err instanceof Error) {
                throw new common_1.BadRequestException(`Failed to process webhook: ${err.message}`);
            }
            throw new common_1.BadRequestException('Failed to process webhook');
        }
    }
    async handleMyFatooraWebhook(event) {
        try {
            await this.donationsService.handlePaymentWebhook(payment_constant_1.PaymentMethodEnum.MYFATOORA, event);
            return { received: true };
        }
        catch (err) {
            if (err instanceof Error) {
                throw new common_1.BadRequestException(`Failed to process webhook: ${err.message}`);
            }
            throw new common_1.BadRequestException('Failed to process webhook');
        }
    }
};
exports.DonationsController = DonationsController;
__decorate([
    (0, common_1.Get)('project/:projectId'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DonationsController.prototype, "findByProject", null);
__decorate([
    (0, common_1.Post)('project/:projectId'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe, campaignExists_pipe_1.campaignExistsPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_donation_dto_1.createDonationDto]),
    __metadata("design:returntype", Promise)
], DonationsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe, donationExists_pipe_1.donationExistsPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DonationsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(roles_constant_1.Role.SUPER_ADMIN, roles_constant_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe, donationExists_pipe_1.donationExistsPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DonationsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('webhook/stripe'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DonationsController.prototype, "handleStripeWebhook", null);
__decorate([
    (0, common_1.Post)('webhook/myfatoora'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DonationsController.prototype, "handleMyFatooraWebhook", null);
exports.DonationsController = DonationsController = __decorate([
    (0, common_1.Controller)('donations'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [donations_service_1.DonationsService])
], DonationsController);
//# sourceMappingURL=donations.controller.js.map