import { Repository, DataSource } from 'typeorm';
import { Donation } from '../donations/entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import { MyFatooraConfig, MyFatooraWebhookData } from '../common/interfaces/myfatoora.interface';
import { PaymentCreateInput, PaymentResult } from '../common/interfaces/payment-service.interface';
export declare class MyFatooraService {
    private readonly config;
    private readonly dataSource;
    private readonly donationRepo;
    private readonly projectRepo;
    private readonly axiosInstance;
    private readonly logger;
    constructor(config: MyFatooraConfig, dataSource: DataSource, donationRepo: Repository<Donation>, projectRepo: Repository<Project>);
    createPayment(input: PaymentCreateInput): Promise<PaymentResult>;
    handleWebhook(payload: MyFatooraWebhookData, signature?: string): Promise<void>;
    getPaymentStatus(paymentId: string): Promise<PaymentResult>;
    private mapStatus;
    private mapToPaymentStatus;
    private verifySignature;
    handlePaymentFailed(donationId: string): Promise<void>;
}
