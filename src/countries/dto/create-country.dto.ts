import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
  IsUUID,
  IsBoolean,
  IsUrl,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';

export class CreateCountryDto {
  @IsString({ message: 'Name must be a string.' })
  @IsNotEmpty({ message: 'Name should not be empty.' })
  name!: string;

  @IsString({ message: 'Code must be a string.' })
  @IsNotEmpty({ message: 'Code should not be empty.' })
  @Length(2, 2, { message: 'Code must be exactly 2 characters.' })
  code!: string;

  @IsOptional()
  @IsUrl({}, { message: 'flagUrl must be a valid URL.' })
  flagUrl?: string;

  @IsOptional()
  @IsString({ message: 'phoneCode must be a string.' })
  phoneCode?: string;

  @IsOptional()
  @IsString({ message: 'currencyCode must be a string.' })
  currencyCode?: string;

  @IsOptional()
  @IsString({ message: 'currencySymbol must be a string.' })
  currencySymbol?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean.' })
  isActive?: boolean;

  @IsUUID('4', { message: 'continentId must be a valid UUID.' })
  continentId!: string;

  // Optional array of project IDs (UUIDs). If provided, it must be a non-empty unique array.
  @IsOptional()
  @IsArray({ message: 'projects must be an array.' })
  @ArrayNotEmpty({ message: 'projects array should not be empty.' })
  @ArrayUnique({ message: 'projects array values must be unique.' })
  @IsUUID('4', { each: true, message: 'Each projectId must be a valid UUID.' })
  projects?: string[];
}
