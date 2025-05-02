import {
  IsString,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class CreateCountryDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsUUID() // Assuming Country entity uses UUID
  @IsNotEmpty()
  countryId: string; // Mapping from PHP '$country' assuming it's a country ID

  @IsUUID() // Assuming Project entity uses UUID
  @IsNotEmpty()
  projectId: string; // Mapping from PHP '$project_id'

  @IsNumber()
  @IsNotEmpty()
  price: number; // Mapping from PHP '$price'

  @IsBoolean()
  status: boolean; // Mapping from PHP '$status'
}
