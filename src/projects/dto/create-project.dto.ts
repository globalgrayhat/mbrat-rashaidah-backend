// [FIXED 2025-06-04]
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDate,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO used when creating a new Project
 * NOTE: Validation decorators guarantee data integrity
 */
export class CreateProjectDto {
  // Project title shown in UI
  @IsNotEmpty()
  @IsString()
  title: string;

  // Project slug for URL
  @IsNotEmpty()
  @IsString()
  slug: string;

  // Full description (supports rich-text on frontend)
  @IsNotEmpty()
  @IsString()
  description: string;

  // Physical or virtual location
  @IsNotEmpty()
  @IsString()
  location: string;

  // Project start date (required)
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  // Project end date (optional)
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  endDate?: Date;

  // Target amount in your default currency
  @IsNumber()
  @Min(0)
  targetAmount: number;

  // FK to Category
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  // FK to Country
  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  // FK to Continent
  @IsUUID()
  @IsNotEmpty()
  continentId: string;

  // Project workflow status (e.g. draft / active / archived)
  @IsOptional()
  @IsString()
  status?: string;

  // Toggle overall visibility
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Toggle donation module
  @IsOptional()
  @IsBoolean()
  isDonationActive?: boolean;

  // Toggle progress bar
  @IsOptional()
  @IsBoolean()
  isProgressActive?: boolean;

  // Toggle target-amount banner
  @IsOptional()
  @IsBoolean()
  isTargetAmountActive?: boolean;

  // Goal value if target banner is on
  @IsNumber()
  @Min(0)
  @IsOptional()
  donationGoal?: number;

  // Array of existing media record IDs to attach
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  mediaIds?: string[];
}