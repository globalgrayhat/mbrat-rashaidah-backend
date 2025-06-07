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
exports.DonationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const donation_entity_1 = require("./entities/donation.entity");
const project_entity_1 = require("../projects/entities/project.entity");
const user_entity_1 = require("../user/entities/user.entity");
const stripe_service_1 = require("../stripe/stripe.service");
const myfatoora_service_1 = require("../myfatoora/myfatoora.service");
const donationStatus_constant_1 = require("../common/constants/donationStatus.constant");
const payment_constant_1 = require("../common/constants/payment.constant");
let DonationsService = class DonationsService {
    dataSource;
    donationRepo;
    projectRepo;
    userRepo;
    stripe;
    myfatoora;
    constructor(dataSource, donationRepo, projectRepo, userRepo, stripe, myfatoora) {
        this.dataSource = dataSource;
        this.donationRepo = donationRepo;
        this.projectRepo = projectRepo;
        this.userRepo = userRepo;
        this.stripe = stripe;
        this.myfatoora = myfatoora;
    }
    async create(createDonationDto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const project = await this.projectRepo.findOne({
                where: { id: createDonationDto.projectId },
            });
            if (!project) {
                throw new common_1.NotFoundException('Project not found');
            }
            if (!project.isDonationActive) {
                throw new common_1.NotAcceptableException('Donations are not active for this project');
            }
            if (createDonationDto.donorId) {
                const donor = await this.userRepo.findOne({
                    where: { id: createDonationDto.donorId },
                });
                if (!donor) {
                    throw new common_1.NotFoundException('Donor not found');
                }
            }
            const donation = this.donationRepo.create({
                ...createDonationDto,
                status: donationStatus_constant_1.DonationStatusEnum.PENDING,
                paymentMethod: createDonationDto.paymentMethod,
            });
            await queryRunner.manager.save(donation);
            let paymentResult;
            if (donation.paymentMethod === payment_constant_1.PaymentMethodEnum.STRIPE) {
                paymentResult = await this.stripe.createPayment({
                    amount: createDonationDto.amount,
                    currency: createDonationDto.currency,
                    donationId: donation.id,
                    projectTitle: project.title,
                });
            }
            else if (donation.paymentMethod === payment_constant_1.PaymentMethodEnum.MYFATOORA) {
                paymentResult = await this.myfatoora.createPayment({
                    amount: createDonationDto.amount,
                    currency: createDonationDto.currency,
                    donationId: donation.id,
                    projectTitle: project.title,
                });
            }
            else {
                throw new common_1.NotAcceptableException('Invalid payment method');
            }
            donation.paymentId = paymentResult.id;
            donation.paymentDetails = paymentResult;
            await queryRunner.manager.save(donation);
            await queryRunner.commitTransaction();
            return {
                donationId: donation.id,
                paymentUrl: paymentResult.url,
            };
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
    async findAll() {
        return this.donationRepo.find({
            relations: ['donor', 'project'],
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id) {
        const donation = await this.donationRepo.findOne({
            where: { id },
            relations: ['donor', 'project'],
        });
        if (!donation) {
            throw new common_1.NotFoundException(`Donation #${id} not found`);
        }
        return donation;
    }
    async findByProject(projectId) {
        return this.donationRepo.find({
            where: { projectId },
            relations: ['donor'],
            order: { createdAt: 'DESC' },
        });
    }
    async findByDonor(donorId) {
        return this.donationRepo.find({
            where: { donorId },
            relations: ['project'],
            order: { createdAt: 'DESC' },
        });
    }
    async update(id, updateDonationDto) {
        const donation = await this.findOne(id);
        Object.assign(donation, updateDonationDto);
        return this.donationRepo.save(donation);
    }
    async remove(id) {
        const result = await this.donationRepo.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`Donation #${id} not found`);
        }
    }
    async handlePaymentWebhook(paymentMethod, event) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let donation = null;
            let status;
            if (paymentMethod === payment_constant_1.PaymentMethodEnum.STRIPE) {
                const stripeEvent = event;
                const session = stripeEvent.data.object;
                donation = await this.donationRepo.findOne({
                    where: { paymentId: session.id },
                    relations: ['project'],
                });
                status =
                    session.payment_status === 'paid'
                        ? donationStatus_constant_1.DonationStatusEnum.COMPLETED
                        : donationStatus_constant_1.DonationStatusEnum.FAILED;
            }
            else if (paymentMethod === payment_constant_1.PaymentMethodEnum.MYFATOORA) {
                const myFatooraEvent = event;
                const payment = myFatooraEvent.body;
                donation = await this.donationRepo.findOne({
                    where: { paymentId: payment.InvoiceId },
                    relations: ['project'],
                });
                status =
                    payment.TransactionStatus === 'SUCCESS'
                        ? donationStatus_constant_1.DonationStatusEnum.COMPLETED
                        : donationStatus_constant_1.DonationStatusEnum.FAILED;
            }
            else {
                throw new common_1.NotAcceptableException('Invalid payment method');
            }
            if (!donation) {
                throw new common_1.NotFoundException('Donation not found');
            }
            donation.status = status;
            donation.paidAt =
                status === donationStatus_constant_1.DonationStatusEnum.COMPLETED ? new Date() : undefined;
            await queryRunner.manager.save(donation);
            if (status === donationStatus_constant_1.DonationStatusEnum.COMPLETED && donation.project) {
                const project = donation.project;
                project.currentAmount =
                    Number(project.currentAmount) + Number(donation.amount);
                project.donationCount += 1;
                await queryRunner.manager.save(project);
            }
            await queryRunner.commitTransaction();
            return { success: true };
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.DonationsService = DonationsService;
exports.DonationsService = DonationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(donation_entity_1.Donation)),
    __param(2, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        stripe_service_1.StripeService,
        myfatoora_service_1.MyFatooraService])
], DonationsService);
//# sourceMappingURL=donations.service.js.map