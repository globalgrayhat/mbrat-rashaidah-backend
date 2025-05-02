import {
  IsOptional,
  IsEnum,
  IsString,
  IsDate,
  IsBoolean,
} from 'class-validator';
import { Role } from '../../common/constants/roles.constant';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsString()
  otp?: string;

  @IsOptional()
  @IsDate()
  otpExpires?: Date;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
