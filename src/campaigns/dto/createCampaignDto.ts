import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  MinLength,
  IsBoolean,
  Min,
  IsEnum,
} from 'class-validator';

import { CampaignStatus } from '../../common/constants/campaignStatus.constant';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  slug: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  startDate: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  targetAmount: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  currentAmount?: number;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID('4', { each: true })
  mediaIds?: string[];

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDonationActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isProgressActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isTargetAmountActive?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  donationGoal?: number;

  @IsOptional()
  @IsUUID()
  createdById?: string;
}
