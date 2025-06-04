import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { CampaignStatusEnum } from '../entities/campaign.entity';

export class EditCampaignDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  amountRequired: number;

  @IsOptional()
  @IsEnum(CampaignStatusEnum)
  campaignStatus: CampaignStatusEnum;
}
