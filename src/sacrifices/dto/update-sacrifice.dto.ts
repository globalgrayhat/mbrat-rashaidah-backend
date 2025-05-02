import { PartialType } from '@nestjs/mapped-types';
import { CreateSacrificeDto } from './create-sacrifice.dto';

export class UpdateSacrificeDto extends PartialType(CreateSacrificeDto) {}
