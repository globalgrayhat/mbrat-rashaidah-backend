import {
  PipeTransform,
  Injectable,
  NotFoundException,
  // ArgumentMetadata,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donation } from '../../donations/entities/donation.entity';

@Injectable()
export class DonationExistsPipe
  implements PipeTransform<string, Promise<string>>
{
  constructor(
    @InjectRepository(Donation)
    private readonly donationRepository: Repository<Donation>,
  ) {}

  async transform(value: string): Promise<string> {
    // Optionally load relations if you need to access them later in the request lifecycle
    const donation = await this.donationRepository.findOne({
      where: { id: value },
      relations: ['donor', 'project', 'campaign'], // Include new relations
    });
    if (!donation) {
      throw new NotFoundException(`Donation with ID "${value}" not found.`);
    }
    return value;
  }
}
