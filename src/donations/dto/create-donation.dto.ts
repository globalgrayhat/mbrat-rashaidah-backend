import {
  IsUUID,
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  ArrayNotEmpty,
  Min,
  // IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethodEnum } from '../../common/constants/payment.constant';
import { CreateDonorDto } from '../../donor/dto/create-donor.dto';

/**
 * DTO representing a single donation item (either to a project or a campaign).
 */
export class DonationItemDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  // @IsString()
  // @IsNotEmpty()
  // @IsEmail()
  // email: string;

  // @IsNumber()
  // phoneNumber: number;
}

/**
 * DTO for creating a new donation request, supporting multiple donation targets.
 */
export class CreateDonationDto {
  @IsEnum(PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDonorDto)
  donorInfo?: CreateDonorDto;

  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => DonationItemDto)
  donationItems: DonationItemDto[];
}
