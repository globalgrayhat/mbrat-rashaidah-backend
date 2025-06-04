import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { CampaignPurposeEnum } from '../entities/campaign.entity';

export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase().trim();
    }
    return '';
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  description: string;

  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  amountRequired: number;

  @IsNotEmpty()
  @IsEnum(CampaignPurposeEnum)
  purpose: CampaignPurposeEnum;
}
