import { PartialType } from '@nestjs/mapped-types';
import { CreateCountryDto } from './create-country.dto';

// PartialType makes all properties of CreateCountryDto optional
export class UpdateCountryDto extends PartialType(CreateCountryDto) {
  // No additional properties needed here unless you have update-specific fields
}
