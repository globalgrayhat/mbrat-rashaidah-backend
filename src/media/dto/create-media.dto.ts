import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { MediaType } from '../../common/constants/media.constant';

export class CreateMediaDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  path: string;

  @IsString()
  mimeType: string;

  @IsNumber()
  size: number;

  @IsEnum(MediaType)
  type: MediaType;

  @IsString()
  @IsOptional()
  altText?: string;

  @IsNumber()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  createdById?: string;
}
