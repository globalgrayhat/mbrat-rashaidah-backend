import { MyFatooraService } from './myfatoora.service';
import { MyFatooraWebhookData } from '../common/interfaces/myfatoora.interface';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
export declare class MyFatooraController {
    private readonly myFatooraService;
    constructor(myFatooraService: MyFatooraService);
    handleWebhook(payload: MyFatooraWebhookData, signature?: string): Promise<{
        status: number;
    }>;
    getPaymentStatus(invoiceId: string): Promise<ReturnType<MyFatooraService['getPaymentStatus']>>;
    handleSuccess(donationId: string): {
        donationId: string;
        code: number;
        message: string;
        DonationStatus: DonationStatusEnum;
    };
    handleCancel(donationId: string): Promise<{
        donationId: string;
        code: number;
        message: string;
        DonationStatus: DonationStatusEnum;
    }>;
}
