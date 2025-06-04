import { PipeTransform, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';

@Injectable()
export class campaignExistsPipe implements PipeTransform<string> {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
  ) {}

  async transform(value: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: value },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign #${value} not found`);
    }

    return value;
  }
}
