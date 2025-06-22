import { PipeTransform } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Donation } from '../../donations/entities/donation.entity';
export declare class donationExistsPipe implements PipeTransform<string> {
    private readonly donationRepo;
    constructor(donationRepo: Repository<Donation>);
    transform(value: string): Promise<string>;
}
