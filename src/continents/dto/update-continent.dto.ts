import { PartialType } from '@nestjs/mapped-types';
import { CreateContinentDto } from './create-continent.dto';

export class UpdateContinentDto extends PartialType(CreateContinentDto) {}
// This class extends CreateProjectDto and makes all properties optional.
