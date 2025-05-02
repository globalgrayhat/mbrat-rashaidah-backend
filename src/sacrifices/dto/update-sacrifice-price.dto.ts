import { PartialType } from '@nestjs/mapped-types';
import { CreateSacrificePriceDto } from './create-sacrifice-price.dto';

export class UpdateSacrificePriceDto extends PartialType(
  CreateSacrificePriceDto,
) {}
