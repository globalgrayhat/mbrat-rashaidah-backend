import {
  PipeTransform,
  Injectable,
  NotFoundException,
  //   ArgumentMetadata,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donor } from '../../donor/entities/donor.entity';

@Injectable()
export class DonorExistsPipe implements PipeTransform<string, Promise<string>> {
  constructor(
    @InjectRepository(Donor)
    private readonly donorRepository: Repository<Donor>,
  ) {}

  async transform(value: string): Promise<string> {
    const donor = await this.donorRepository.findOne({ where: { id: value } });
    if (!donor) {
      throw new NotFoundException(`Donor with ID "${value}" not found.`);
    }
    return value;
  }
}
