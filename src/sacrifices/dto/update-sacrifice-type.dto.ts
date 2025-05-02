import { PartialType } from '@nestjs/mapped-types';
import { CreateSacrificeTypeDto } from './create-sacrifice-type.dto';

export class UpdateSacrificeTypeDto extends PartialType(
  CreateSacrificeTypeDto,
) {}
