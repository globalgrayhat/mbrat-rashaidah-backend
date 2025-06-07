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
exports.MyFatooraController = void 0;
const common_1 = require("@nestjs/common");
const myfatoora_service_1 = require("./myfatoora.service");
const donationStatus_constant_1 = require("../common/constants/donationStatus.constant");
const donationExists_pipe_1 = require("../common/pipes/donationExists.pipe");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
let MyFatooraController = class MyFatooraController {
    myFatooraService;
    constructor(myFatooraService) {
        this.myFatooraService = myFatooraService;
    }
    async handleWebhook(payload, signature) {
        await this.myFatooraService.handleWebhook(payload, signature);
        return { status: common_1.HttpStatus.OK };
    }
    async getPaymentStatus(invoiceId) {
        return this.myFatooraService.getPaymentStatus(invoiceId);
    }
    handleSuccess(donationId) {
        return {
            donationId,
            code: common_1.HttpStatus.OK,
            message: 'Payment successful',
            DonationStatus: donationStatus_constant_1.DonationStatusEnum.COMPLETED,
        };
    }
    async handleCancel(donationId) {
        await this.myFatooraService.handlePaymentFailed(donationId);
        return {
            donationId,
            code: common_1.HttpStatus.EXPECTATION_FAILED,
            message: 'Payment canceled',
            DonationStatus: donationStatus_constant_1.DonationStatusEnum.FAILED,
        };
    }
};
exports.MyFatooraController = MyFatooraController;
__decorate([
    (0, common_1.Post)('webhook'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-myfatoorah-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MyFatooraController.prototype, "handleWebhook", null);
__decorate([
    (0, common_1.Get)('status/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MyFatooraController.prototype, "getPaymentStatus", null);
__decorate([
    (0, common_1.Get)('success/:donationId'),
    (0, common_1.UsePipes)(common_1.ParseIntPipe, donationExists_pipe_1.donationExistsPipe),
    __param(0, (0, common_1.Param)('donationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], MyFatooraController.prototype, "handleSuccess", null);
__decorate([
    (0, common_1.Get)('cancel/:donationId'),
    (0, common_1.UsePipes)(common_1.ParseIntPipe, donationExists_pipe_1.donationExistsPipe),
    __param(0, (0, common_1.Param)('donationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MyFatooraController.prototype, "handleCancel", null);
exports.MyFatooraController = MyFatooraController = __decorate([
    (0, common_1.Controller)('myfatoora'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [myfatoora_service_1.MyFatooraService])
], MyFatooraController);
//# sourceMappingURL=myfatoora.controller.js.map