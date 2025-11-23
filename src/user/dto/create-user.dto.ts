import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail() email: string;
  @IsNotEmpty() password: string;
  @IsOptional()
  @IsString()
  username?: string;
  @IsOptional()
  @IsString()
  fullName?: string;
}
