import { PartialType } from '@nestjs/mapped-types';
import { CreateCampaignDto } from './createCampaignDto';

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}
// This class extends CreateProjectDto and makes all properties optional.
