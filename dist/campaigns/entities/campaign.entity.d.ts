import { Project } from '../../projects/entities/project.entity';
import { User } from '../../user/entities/user.entity';
import { CampaignPurposeEnum } from '../../common/constants/campaignPurpose.constant';
import { CampaignStatusEnum } from '../../common/constants/campaignStatus.constant';
export declare class Campaign {
    id: string;
    name: string;
    description?: string;
    amountRequired: number;
    amountRaised: number;
    amountLeft: number;
    purpose: CampaignPurposeEnum;
    campaignStatus: CampaignStatusEnum;
    official: User;
    officialId: string;
    project?: Project;
    projectId?: string;
    createdAt: Date;
    updatedAt: Date;
}
