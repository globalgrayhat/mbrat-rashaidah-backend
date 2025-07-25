import {
  PipeTransform,
  Injectable,
  NotFoundException,
  // ArgumentMetadata,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';

@Injectable()
export class CampaignExistsPipe
  implements PipeTransform<string, Promise<string>>
{
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
  ) {}

  async transform(value: string): Promise<string> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: value },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${value}" not found.`);
    }
    return value;
  }
}
