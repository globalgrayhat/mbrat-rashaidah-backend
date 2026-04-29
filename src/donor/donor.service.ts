import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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

  /**
   * Resolves an existing donor or creates a new one safely.
   * Handles concurrency by retrying the find if a unique constraint violation occurs.
   *
   * @param donorInfo Donor details from the donation request
   * @param em EntityManager to use within the donation transaction
   */
  async resolveOrCreate(
    donorInfo: {
      userId?: string;
      email?: string;
      fullName?: string;
      phoneNumber?: string;
      isAnonymous?: boolean;
    },
    em: EntityManager,
  ): Promise<Donor | null> {
    if (!donorInfo) return null;

    const { userId, isAnonymous, fullName, phoneNumber } = donorInfo;
    const email = donorInfo.email?.toLowerCase().trim();

    // 1. Registered User Path: userId is the primary identifier
    if (userId) {
      // Check if donor already exists for this user
      let donor = await em.findOne(Donor, { where: { userId } });
      if (donor) {
        // Sync anonymity preference if provided
        if (isAnonymous !== undefined && donor.isAnonymous !== isAnonymous) {
          donor.isAnonymous = isAnonymous;
          return await em.save(donor);
        }
        return donor;
      }

      // Resolve user details for the new donor record
      const user = await em.findOne(User, { where: { id: userId } });
      if (!user)
        throw new NotFoundException(`User with ID ${userId} not found`);

      donor = this.donorRepository.create({
        userId,
        fullName: fullName || user.fullName || user.username,
        email: email || user.email,
        isAnonymous: isAnonymous ?? false,
      });

      try {
        return await em.save(donor);
      } catch (error) {
        // Handle race condition: another request might have created the donor record
        const retryDonor = await em.findOne(Donor, { where: { userId } });
        if (retryDonor) return retryDonor;
        throw error;
      }
    }

    // 2. Guest Donor Path: use email as identifier for non-registered users
    if (email) {
      // Try to find an existing guest donor with this email
      let donor = await em.findOne(Donor, {
        where: { email, userId: null } as any,
      });
      if (donor) return donor;

      donor = this.donorRepository.create({
        fullName: fullName?.trim() || 'Guest Donor',
        email,
        phoneNumber: phoneNumber?.trim(),
        isAnonymous: isAnonymous ?? false,
      });

      try {
        return await em.save(donor);
      } catch (error) {
        // Fallback for concurrent guest creation
        const retryDonor = await em.findOne(Donor, {
          where: { email, userId: null } as any,
        });
        if (retryDonor) return retryDonor;
        throw error;
      }
    }

    // 3. Anonymous Path: create a one-time anonymous record
    const anonymousDonor = this.donorRepository.create({
      fullName: fullName?.trim() || 'Anonymous Donor',
      isAnonymous: true,
      phoneNumber: phoneNumber?.trim(),
    });

    return await em.save(anonymousDonor);
  }

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
