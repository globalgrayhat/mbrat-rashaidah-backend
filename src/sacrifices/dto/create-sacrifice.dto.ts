import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsUUID,
  IsNotEmpty,
  IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSacrificeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @IsISO8601()
  @Type(() => Date)
  date: Date;

  @IsUUID()
  @IsOptional()
  donorId?: string;
}
