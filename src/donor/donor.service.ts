import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donor } from './entities/donor.entity';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { User } from '../user/entities/user.entity';

@Injectable()
export class DonorsService {
  constructor(
    @InjectRepository(Donor)
    private readonly donorRepository: Repository<Donor>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createDonorDto: CreateDonorDto): Promise<Donor> {
    const { userId, email, isAnonymous } = createDonorDto;

    if (userId) {
      const existingDonor = await this.donorRepository.findOne({
        where: { userId },
      });
      if (existingDonor) {
        throw new ConflictException(
          `Donor already exists for user ID "${userId}".`,
        );
      }
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(`User with ID "${userId}" not found.`);
      }
      // Populate fullName and email from user if not explicitly provided
      const newDonor = this.donorRepository.create({
        ...createDonorDto,
        fullName: createDonorDto.fullName || user.fullName || user.username,
        email: createDonorDto.email || user.email,
        isAnonymous: isAnonymous ?? false, // Default to false if userId is provided
        user: user,
      });
      return this.donorRepository.save(newDonor);
    } else {
      // For anonymous/non-user linked donors, email can be optional but if provided should be unique across anonymous.
      // However, multiple anonymous donors might use the same email, so we don't enforce unique here.
      if (!isAnonymous && !email) {
        throw new BadRequestException(
          'Email is required for non-anonymous donors without a linked user.',
        );
      }
      const newDonor = this.donorRepository.create({
        ...createDonorDto,
        isAnonymous: isAnonymous ?? true, // Default to true if no userId
      });
      return this.donorRepository.save(newDonor);
    }
  }

  async findAll(): Promise<Donor[]> {
    return this.donorRepository.find({ relations: ['user'] });
  }

  async findOne(id: string): Promise<Donor> {
    const donor = await this.donorRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!donor) {
      throw new NotFoundException(`Donor with ID "${id}" not found.`);
    }
    return donor;
  }

  async update(id: string, updateDonorDto: UpdateDonorDto): Promise<Donor> {
    const donor = await this.findOne(id);

    // Prevent changing userId if it's already set
    if (
      donor.userId &&
      updateDonorDto.userId &&
      donor.userId !== updateDonorDto.userId
    ) {
      throw new BadRequestException(
        'Cannot re-link a donor to a different user.',
      );
    }
    // Prevent setting userId if it's already set or linking to an already linked user
    if (!donor.userId && updateDonorDto.userId) {
      const existingUserLinkedDonor = await this.donorRepository.findOne({
        where: { userId: updateDonorDto.userId },
      });
      if (existingUserLinkedDonor && existingUserLinkedDonor.id !== id) {
        throw new ConflictException(
          `User ID "${updateDonorDto.userId}" is already linked to another donor.`,
        );
      }
      const user = await this.userRepository.findOne({
        where: { id: updateDonorDto.userId },
      });
      if (!user) {
        throw new NotFoundException(
          `User with ID "${updateDonorDto.userId}" not found.`,
        );
      }
      donor.user = user;
    }

    Object.assign(donor, updateDonorDto);
    return this.donorRepository.save(donor);
  }

  async remove(id: string): Promise<void> {
    const result = await this.donorRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Donor with ID "${id}" not found.`);
    }
  }
}
