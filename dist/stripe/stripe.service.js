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
exports.StripeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const donation_entity_1 = require("../donations/entities/donation.entity");
const project_entity_1 = require("../projects/entities/project.entity");
const stripe_1 = require("stripe");
const donationStatus_constant_1 = require("../common/constants/donationStatus.constant");
let StripeService = class StripeService {
    config;
    dataSource;
    donationRepo;
    projectRepo;
    stripe;
    constructor(config, dataSource, donationRepo, projectRepo) {
        this.config = config;
        this.dataSource = dataSource;
        this.donationRepo = donationRepo;
        this.projectRepo = projectRepo;
        const apiKey = this.config.get('STRIPE_SECRET_KEY');
        if (!apiKey) {
            throw new Error('Stripe secret key not configured');
        }
        this.stripe = new stripe_1.default(apiKey, { apiVersion: '2025-05-28.basil' });
    }
    async createPayment(input) {
        const successUrl = this.config.get('STRIPE_SUCCESS_URL');
        const cancelUrl = this.config.get('STRIPE_CANCEL_URL');
        if (!successUrl || !cancelUrl) {
            throw new common_1.BadRequestException('Stripe URLs not configured');
        }
        const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: input.currency.toLowerCase(),
                        unit_amount: Math.round(input.amount * 100),
                        product_data: { name: `Donation for ${input.projectTitle}` },
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${successUrl}/${input.donationId}`,
            cancel_url: `${cancelUrl}/${input.donationId}`,
        });
        return {
            id: session.id,
            url: session.url,
            status: this.mapStatus(session.status ?? 'unknown'),
        };
    }
    constructEvent(payload, signature) {
        const secret = this.config.get('STRIPE_WEBHOOK_SECRET');
        if (!secret)
            throw new common_1.BadRequestException('Missing Stripe webhook secret');
        try {
            return this.stripe.webhooks.constructEvent(payload, signature, secret);
        }
        catch {
            throw new common_1.BadRequestException('Invalid Stripe webhook signature');
        }
    }
    async handlePaymentSucceeded(sessionId) {
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const donation = await this.donationRepo.findOne({
                where: { paymentId: sessionId },
                relations: ['project'],
            });
            if (!donation)
                throw new common_1.BadRequestException('Donation not found');
            donation.status = donationStatus_constant_1.DonationStatusEnum.COMPLETED;
            donation.paidAt = new Date();
            await qr.manager.save(donation);
            if (donation.project) {
                donation.project.currentAmount += donation.amount;
                donation.project.donationCount += 1;
                await qr.manager.save(donation.project);
            }
            await qr.commitTransaction();
        }
        catch (err) {
            await qr.rollbackTransaction();
            throw new common_1.BadRequestException(`Failed to process payment: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
        finally {
            await qr.release();
        }
    }
    async handlePaymentFailed(sessionId) {
        const result = await this.donationRepo.update({ paymentId: sessionId, status: donationStatus_constant_1.DonationStatusEnum.PENDING }, { status: donationStatus_constant_1.DonationStatusEnum.FAILED });
        if (result.affected === 0) {
            throw new common_1.ForbiddenException('No pending donation updated');
        }
    }
    async getPaymentStatus(id) {
        const session = await this.stripe.checkout.sessions.retrieve(id);
        const intentId = session.payment_intent;
        const intent = intentId
            ? await this.stripe.paymentIntents.retrieve(intentId)
            : null;
        return {
            id,
            status: this.mapStatus(session.status ?? 'unknown'),
            amount: session.amount_total / 100,
            currency: session.currency.toUpperCase(),
            paymentMethod: 'STRIPE',
            metadata: { paymentIntentStatus: intent?.status },
        };
    }
    mapStatus(status) {
        switch (status) {
            case 'open':
            case 'created':
                return 'pending';
            case 'processing':
                return 'processing';
            case 'paid':
            case 'complete':
                return 'completed';
            default:
                return 'failed';
        }
    }
};
exports.StripeService = StripeService;
exports.StripeService = StripeService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(donation_entity_1.Donation)),
    __param(3, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.DataSource,
        typeorm_2.Repository,
        typeorm_2.Repository])
], StripeService);
//# sourceMappingURL=stripe.service.js.map