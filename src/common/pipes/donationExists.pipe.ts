import { PipeTransform, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donation } from '../../donations/entities/donation.entity';

@Injectable()
export class donationExistsPipe implements PipeTransform<string> {
  constructor(
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
  ) {}

  async transform(value: string) {
    const donation = await this.donationRepo.findOne({
      where: { id: value },
    });

    if (!donation) {
      throw new NotFoundException(`Donation #${value} not found`);
    }

    return value;
  }
}
