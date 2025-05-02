import { IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateContinentDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  description?: string;
}
