import { PartialType } from '@nestjs/mapped-types';
import { CreateDonationDto } from './create-donation.dto';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { DonationStatusEnum } from '../../common/constants/donationStatus.constant';

export class UpdateDonationDto extends PartialType(CreateDonationDto) {
  @IsOptional()
  @IsEnum(DonationStatusEnum)
  status?: DonationStatusEnum;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  paymentDetails?: any;

  @IsOptional()
  @IsString()
  readonly projectId?: string;

  @IsOptional()
  @IsString()
  readonly campaignId?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsNumber()
  phoneNumber: number;
}
