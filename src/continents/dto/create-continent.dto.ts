import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
  IsBoolean,
} from 'class-validator';

export class CreateContinentDto {
  @IsString({ message: 'Name must be a string.' })
  @IsNotEmpty({ message: 'Name should not be empty.' })
  name!: string;

  @IsString({ message: 'Code must be a string.' })
  @IsNotEmpty({ message: 'Code should not be empty.' })
  @Length(2, 2, { message: 'Code must be exactly 2 characters.' })
  code!: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean.' })
  isActive?: boolean;
}
