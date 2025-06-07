import { Request } from 'express';
import { StripeService } from './stripe.service';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
export declare class StripeController {
    private readonly stripeService;
    constructor(stripeService: StripeService);
    handleWebhook(req: Request): Promise<{
        status: number;
    }>;
    getStatus(sessionId: string): Promise<ReturnType<StripeService['getPaymentStatus']>>;
    handleSuccess(donationId: string): Promise<{
        donationId: string;
        code: number;
        message: string;
        DonationStatus: DonationStatusEnum;
    }>;
    handleCancel(donationId: string): Promise<{
        donationId: string;
        code: number;
        message: string;
        DonationStatus: DonationStatusEnum;
    }>;
}
