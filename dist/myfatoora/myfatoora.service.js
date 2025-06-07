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
var MyFatooraService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyFatooraService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const crypto = require("crypto");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const donation_entity_1 = require("../donations/entities/donation.entity");
const project_entity_1 = require("../projects/entities/project.entity");
const donationStatus_constant_1 = require("../common/constants/donationStatus.constant");
let MyFatooraService = MyFatooraService_1 = class MyFatooraService {
    config;
    dataSource;
    donationRepo;
    projectRepo;
    axiosInstance;
    logger = new common_1.Logger(MyFatooraService_1.name);
    constructor(config, dataSource, donationRepo, projectRepo) {
        this.config = config;
        this.dataSource = dataSource;
        this.donationRepo = donationRepo;
        this.projectRepo = projectRepo;
        this.axiosInstance = axios_1.default.create({
            baseURL: this.config.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.config.apiKey}`,
            },
        });
    }
    async createPayment(input) {
        const payload = {
            CustomerName: input.customerName || 'Anonymous Donor',
            NotificationOption: 'Lnk',
            InvoiceValue: input.amount,
            DisplayCurrencyIso: input.currency,
            CustomerMobile: input.customerPhone || '',
            CustomerEmail: input.customerEmail || '',
            CallBackUrl: `${this.config.successUrl}/${input.donationId}`,
            ErrorUrl: `${this.config.errorUrl}/${input.donationId}`,
            Language: 'en',
            CustomerReference: input.donationId,
            SourceInfo: 'Web',
        };
        try {
            const response = await this.axiosInstance.post('/v2/SendPayment', payload);
            const data = response.data;
            if (!data.IsSuccess || !data.Data) {
                throw new common_1.BadRequestException(`MyFatoora SendPayment failed: ${data.Message}`);
            }
            return {
                id: data.Data.InvoiceId.toString(),
                url: data.Data.PaymentURL,
                status: 'pending',
                amount: input.amount,
                currency: input.currency,
                paymentMethod: 'MYFATOORA',
                metadata: {
                    invoiceId: data.Data.InvoiceId,
                    customerReference: data.Data.CustomerReference,
                },
            };
        }
        catch (err) {
            this.logger.error('CreatePayment error', err);
            throw new common_1.InternalServerErrorException(`Unable to create MyFatoora payment: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }
    async handleWebhook(payload, signature) {
        if (this.config.webhookSecret && signature) {
            const valid = this.verifySignature(JSON.stringify(payload), signature);
            if (!valid) {
                throw new common_1.BadRequestException('Invalid MyFatoora webhook signature');
            }
        }
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const donation = await this.donationRepo.findOne({
                where: { paymentId: payload.InvoiceId.toString() },
                relations: ['project'],
            });
            if (!donation)
                throw new common_1.NotFoundException('Donation not found');
            donation.status = this.mapStatus(payload.InvoiceStatus);
            if (donation.status === donationStatus_constant_1.DonationStatusEnum.COMPLETED)
                donation.paidAt = new Date();
            await qr.manager.save(donation);
            if (donation.project &&
                donation.status === donationStatus_constant_1.DonationStatusEnum.COMPLETED) {
                donation.project.currentAmount += donation.amount;
                donation.project.donationCount += 1;
                await qr.manager.save(donation.project);
            }
            await qr.commitTransaction();
        }
        catch (err) {
            await qr.rollbackTransaction();
            this.logger.error('Webhook processing failed', err);
            throw new common_1.BadRequestException(`Webhook processing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        finally {
            await qr.release();
        }
    }
    async getPaymentStatus(paymentId) {
        const payload = {
            Key: parseInt(paymentId, 10),
            KeyType: 'InvoiceId',
        };
        try {
            const resp = await this.axiosInstance.post('/v2/getpaymentstatus', payload);
            const data = resp.data;
            if (!data.IsSuccess || !data.Data) {
                throw new common_1.BadRequestException(`getPaymentStatus failed: ${data.Message}`);
            }
            return {
                id: paymentId,
                status: this.mapToPaymentStatus(this.mapStatus(data.Data.InvoiceStatus)),
                amount: data.Data.InvoiceValue,
                currency: data.Data.PaidCurrency,
                paymentMethod: 'MYFATOORA',
                metadata: {
                    invoiceStatus: data.Data.InvoiceStatus,
                    paymentDate: data.Data.PaymentDate,
                },
            };
        }
        catch (err) {
            this.logger.error('getPaymentStatus error', err);
            throw new common_1.InternalServerErrorException(`Unable to fetch MyFatoora status: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }
    mapStatus(status) {
        switch (status) {
            case 'Paid':
                return donationStatus_constant_1.DonationStatusEnum.COMPLETED;
            case 'Pending':
                return donationStatus_constant_1.DonationStatusEnum.PENDING;
            case 'Failed':
            case 'Expired':
                return donationStatus_constant_1.DonationStatusEnum.FAILED;
            default:
                return donationStatus_constant_1.DonationStatusEnum.FAILED;
        }
    }
    mapToPaymentStatus(status) {
        switch (status) {
            case donationStatus_constant_1.DonationStatusEnum.COMPLETED:
                return 'completed';
            case donationStatus_constant_1.DonationStatusEnum.PENDING:
                return 'pending';
            case donationStatus_constant_1.DonationStatusEnum.FAILED:
                return 'failed';
            default:
                return 'failed';
        }
    }
    verifySignature(body, sig) {
        const hash = crypto
            .createHmac('sha256', this.config.webhookSecret)
            .update(body, 'utf8')
            .digest('hex');
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(sig));
    }
    async handlePaymentFailed(donationId) {
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const donation = await this.donationRepo.findOne({
                where: { id: donationId },
            });
            if (!donation)
                throw new common_1.NotFoundException('Donation not found');
            donation.status = donationStatus_constant_1.DonationStatusEnum.FAILED;
            await qr.manager.save(donation);
            await qr.commitTransaction();
        }
        catch (err) {
            await qr.rollbackTransaction();
            throw new common_1.BadRequestException(`Failed to mark donation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        finally {
            await qr.release();
        }
    }
};
exports.MyFatooraService = MyFatooraService;
exports.MyFatooraService = MyFatooraService = MyFatooraService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('MYFATOORA_CONFIG')),
    __param(2, (0, typeorm_1.InjectRepository)(donation_entity_1.Donation)),
    __param(3, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __metadata("design:paramtypes", [Object, typeorm_2.DataSource,
        typeorm_2.Repository,
        typeorm_2.Repository])
], MyFatooraService);
//# sourceMappingURL=myfatoora.service.js.map