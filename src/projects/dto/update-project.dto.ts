// [FIXED 2025-06-04]
import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
// This class extends CreateProjectDto and makes all properties optional.
