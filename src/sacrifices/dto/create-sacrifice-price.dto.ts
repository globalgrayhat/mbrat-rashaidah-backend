import {
  IsNumber,
  IsBoolean,
  IsUUID,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSacrificePriceDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  price: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsUUID()
  @IsNotEmpty()
  sacrificeTypeId: string;

  @IsUUID()
  @IsNotEmpty()
  countryId: string;
}
