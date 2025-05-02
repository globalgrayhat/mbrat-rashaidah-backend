import { PartialType } from '@nestjs/mapped-types'; // Or '@nestjs/swagger' if installed and preferred
import { CreateMediaDto } from './create-media.dto';

// PartialType makes all properties of CreateMediaDto optional
export class UpdateMediaDto extends PartialType(CreateMediaDto) {
  // No additional properties needed here unless you have update-specific fields
}
