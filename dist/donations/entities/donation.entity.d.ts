import { Project } from '../../projects/entities/project.entity';
import { User } from '../../user/entities/user.entity';
import { DonationStatusEnum } from '../../common/constants/donationStatus.constant';
import { PaymentMethodEnum } from '../../common/constants/payment.constant';
export declare class Donation {
    id: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethodEnum;
    status: DonationStatusEnum;
    paymentId?: string;
    paymentDetails?: any;
    paidAt?: Date;
    project: Project;
    projectId: string;
    donor?: User;
    donorId?: string;
    createdAt: Date;
    updatedAt: Date;
}
