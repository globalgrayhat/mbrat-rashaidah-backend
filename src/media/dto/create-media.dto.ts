import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer'; // Needed for @Type()

export class CreateMediaDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  type: string; // e.g., 'image', 'video', 'document'

  @IsUrl() // Validates that the string is a URL
  @IsNotEmpty()
  url: string;

  @IsUrl()
  @IsOptional() // Based on your entity nullable: true
  thumbnailUrl?: string;

  @IsString()
  @IsOptional() // Based on your entity nullable: true
  description?: string;

  @IsString()
  @IsOptional() // Based on your entity nullable: true
  altText?: string;

  @IsNumber()
  @IsOptional() // Based on your entity default: 0
  @Type(() => Number) // Ensure value is number
  displayOrder?: number;

  @IsBoolean()
  @IsOptional() // Based on your entity default: true
  isActive?: boolean;

  @IsUUID()
  @IsOptional() // Based on your entity nullable: true
  createdById?: string; // Assuming user ID is UUID and nullable
}
