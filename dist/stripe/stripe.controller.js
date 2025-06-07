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
exports.StripeController = void 0;
const common_1 = require("@nestjs/common");
const stripe_service_1 = require("./stripe.service");
const donationStatus_constant_1 = require("../common/constants/donationStatus.constant");
const donationExists_pipe_1 = require("../common/pipes/donationExists.pipe");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
let StripeController = class StripeController {
    stripeService;
    constructor(stripeService) {
        this.stripeService = stripeService;
    }
    async handleWebhook(req) {
        const signature = req.headers['stripe-signature'];
        if (!signature) {
            throw new common_1.BadRequestException('Missing Stripe signature header');
        }
        const event = this.stripeService.constructEvent(req.body, signature);
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            await this.stripeService.handlePaymentSucceeded(session.id);
        }
        return { status: common_1.HttpStatus.OK };
    }
    async getStatus(sessionId) {
        return this.stripeService.getPaymentStatus(sessionId);
    }
    async handleSuccess(donationId) {
        await new donationExists_pipe_1.donationExistsPipe(this.stripeService['donationRepo']).transform(donationId);
        return {
            donationId,
            code: common_1.HttpStatus.OK,
            message: 'Payment successful',
            DonationStatus: donationStatus_constant_1.DonationStatusEnum.COMPLETED,
        };
    }
    async handleCancel(donationId) {
        await new donationExists_pipe_1.donationExistsPipe(this.stripeService['donationRepo']).transform(donationId);
        await this.stripeService.handlePaymentFailed(donationId);
        return {
            donationId,
            code: common_1.HttpStatus.EXPECTATION_FAILED,
            message: 'Payment canceled',
            DonationStatus: donationStatus_constant_1.DonationStatusEnum.FAILED,
        };
    }
};
exports.StripeController = StripeController;
__decorate([
    (0, common_1.Post)('webhook'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StripeController.prototype, "handleWebhook", null);
__decorate([
    (0, common_1.Get)('status/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StripeController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('success/:donationId'),
    __param(0, (0, common_1.Param)('donationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StripeController.prototype, "handleSuccess", null);
__decorate([
    (0, common_1.Get)('cancel/:donationId'),
    __param(0, (0, common_1.Param)('donationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StripeController.prototype, "handleCancel", null);
exports.StripeController = StripeController = __decorate([
    (0, common_1.Controller)('stripe'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [stripe_service_1.StripeService])
], StripeController);
//# sourceMappingURL=stripe.controller.js.map