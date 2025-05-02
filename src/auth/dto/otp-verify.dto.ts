import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class OtpVerifyDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  otp: string;
}
