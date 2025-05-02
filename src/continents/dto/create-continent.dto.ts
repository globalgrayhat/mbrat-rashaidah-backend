import { IsNotEmpty } from 'class-validator';

export class CreateContinentDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  description: string;
}
