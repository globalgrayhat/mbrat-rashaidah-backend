import {
  IsUUID,
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  ValidateIf,
  Min,
  Validate,
} from 'class-validator';
import { PaymentMethodEnum } from '../../common/constants/payment.constant';
import { CreateDonorDto } from '../../donor/dto/create-donor.dto';
import { Type } from 'class-transformer';
import { IsValidDonationTargetConstraint } from '../../common/validators/IsValidDonationTarget.validator';

export class CreateDonationDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsEnum(PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum;

  @IsOptional()
  @IsUUID()
  @ValidateIf((o: CreateDonationDto) => !o.campaignId)
  projectId?: string;

  @IsOptional()
  @IsUUID()
  @ValidateIf((o: CreateDonationDto) => !o.projectId)
  campaignId?: string;

  @IsOptional()
  @Type(() => CreateDonorDto)
  donorInfo?: CreateDonorDto;

  // Apply custom validator to ensure exactly one of projectId or campaignId is set
  @Validate(IsValidDonationTargetConstraint)
  _targetCheck: any;
}
