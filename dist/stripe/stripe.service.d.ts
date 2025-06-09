import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { Donation } from '../donations/entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import Stripe from 'stripe';
import { PaymentCreateInput, PaymentResult } from '../common/interfaces/payment-service.interface';
export declare class StripeService {
    private readonly config;
    private readonly dataSource;
    private readonly donationRepo;
    private readonly projectRepo;
    private readonly stripe;
    constructor(config: ConfigService, dataSource: DataSource, donationRepo: Repository<Donation>, projectRepo: Repository<Project>);
    createPayment(input: PaymentCreateInput): Promise<PaymentResult>;
    constructEvent(payload: Buffer, signature: string): Stripe.Event;
    handlePaymentSucceeded(sessionId: string): Promise<void>;
    handlePaymentFailed(sessionId: string): Promise<void>;
    getPaymentStatus(id: string): Promise<PaymentResult>;
    private mapStatus;
}
