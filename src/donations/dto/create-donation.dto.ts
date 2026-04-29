/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  ArrayNotEmpty,
  Min,
  // IsEmail,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
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
  /**
   * Optional idempotency key to prevent duplicate donations on retry.
   * If provided and a donation with this key already exists, returns the existing donation.
   * Client should generate a unique key (e.g., UUID) for each donation attempt.
   * This field is optional - if not provided, keeps current behavior.
   */
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  /**
   * Optional correlation ID for request tracing.
   * If provided, this ID will be logged for tracing the request.
   * Useful for debugging in production.
   */
  @IsOptional()
  @IsString()
  correlationId?: string;

  /**
   * Payment method ID from the payment provider (e.g., MyFatoorah, Stripe, PayMob).
   * Can be provided as number or string by the client; we normalize it to string.
   * Stored as string in database to support any provider's payment method IDs.
   */
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) =>
    value !== undefined && value !== null ? String(value) : value,
  )
  paymentMethod: string;

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
