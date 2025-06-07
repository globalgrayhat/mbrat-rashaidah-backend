import { DonationsService } from './donations.service';
import { createDonationDto } from './dto/create-donation.dto';
import { StripeEvent, MyFatooraEvent } from '../common/interfaces/payment.interface';
export declare class DonationsController {
    private readonly donationsService;
    constructor(donationsService: DonationsService);
    findByProject(projectId: string): Promise<import("./entities/donation.entity").Donation[]>;
    create(projectId: string, createDonationDto: createDonationDto): Promise<{
        donationId: string;
        paymentUrl: string | undefined;
    }>;
    findOne(id: string): Promise<import("./entities/donation.entity").Donation>;
    remove(id: string): Promise<void>;
    handleStripeWebhook(event: StripeEvent, type: string): Promise<{
        received: boolean;
    }>;
    handleMyFatooraWebhook(event: MyFatooraEvent): Promise<{
        received: boolean;
    }>;
}
