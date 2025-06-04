import { PartialType } from '@nestjs/mapped-types';
import { createDonationDto } from './create-donation.dto';

export class UpdateDonationDto extends PartialType(createDonationDto) {}
