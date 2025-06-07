import { DataSource, Repository } from 'typeorm';
import { createDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { Donation } from './entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../user/entities/user.entity';
import { StripeService } from '../stripe/stripe.service';
import { MyFatooraService } from '../myfatoora/myfatoora.service';
import { StripeEvent, MyFatooraEvent } from '../common/interfaces/payment.interface';
import { PaymentMethodEnum } from '../common/constants/payment.constant';
export declare class DonationsService {
    private readonly dataSource;
    private readonly donationRepo;
    private readonly projectRepo;
    private readonly userRepo;
    private readonly stripe;
    private readonly myfatoora;
    constructor(dataSource: DataSource, donationRepo: Repository<Donation>, projectRepo: Repository<Project>, userRepo: Repository<User>, stripe: StripeService, myfatoora: MyFatooraService);
    create(createDonationDto: createDonationDto): Promise<{
        donationId: string;
        paymentUrl: string | undefined;
    }>;
    findAll(): Promise<Donation[]>;
    findOne(id: string): Promise<Donation>;
    findByProject(projectId: string): Promise<Donation[]>;
    findByDonor(donorId: string): Promise<Donation[]>;
    update(id: string, updateDonationDto: UpdateDonationDto): Promise<Donation>;
    remove(id: string): Promise<void>;
    handlePaymentWebhook(paymentMethod: PaymentMethodEnum, event: StripeEvent | MyFatooraEvent): Promise<{
        success: boolean;
    }>;
}
