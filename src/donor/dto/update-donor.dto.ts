import { PartialType } from '@nestjs/mapped-types';
import { CreateDonorDto } from './create-donor.dto';

export class UpdateDonorDto extends PartialType(CreateDonorDto) {}
