import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Banner } from './entities/banner.entity';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class BannersService {
  constructor(
    @InjectRepository(Banner)
    private readonly bannerRepository: Repository<Banner>,
  ) {}

  async create(
    createBannerDto: CreateBannerDto,
    userId: string,
  ): Promise<Banner> {
    const banner = this.bannerRepository.create({
      ...createBannerDto,
      createdById: userId,
    });
    return this.bannerRepository.save(banner);
  }

  async findAll(): Promise<Banner[]> {
    return this.bannerRepository.find({
      order: {
        displayOrder: 'ASC',
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Banner> {
    const banner = await this.bannerRepository.findOne({ where: { id } });
    if (!banner) {
      throw new NotFoundException(`Banner with ID "${id}" not found`);
    }
    return banner;
  }

  async update(id: string, updateBannerDto: UpdateBannerDto): Promise<Banner> {
    const banner = await this.findOne(id);
    Object.assign(banner, updateBannerDto);
    return this.bannerRepository.save(banner);
  }

  async remove(id: string): Promise<void> {
    const result = await this.bannerRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Banner with ID "${id}" not found`);
    }
  }
}
