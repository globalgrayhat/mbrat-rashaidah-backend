import { CampaignPurposeEnum } from '../../common/constants/campaignPurpose.constant';
export declare class CreateCampaignDto {
    name: string;
    description: string;
    amountRequired: number;
    purpose: CampaignPurposeEnum;
}
