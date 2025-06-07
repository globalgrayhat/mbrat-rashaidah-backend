import { PipeTransform } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
export declare class campaignExistsPipe implements PipeTransform<string> {
    private readonly campaignRepo;
    constructor(campaignRepo: Repository<Campaign>);
    transform(value: string): Promise<string>;
}
