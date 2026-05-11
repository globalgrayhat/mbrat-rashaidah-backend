import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Banner } from './entities/banner.entity';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { User } from '../user/entities/user.entity';
import { Media } from '../media/entities/media.entity';
import { PaginationService } from '../common/pagination/pagination.service';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { CollectionResponseDto } from '../common/pagination/dto/collection-response.dto';
import { ReorderPinnedDto } from '../common/pagination/dto/reorder-pinned.dto';
@Injectable()
export class BannersService {
  constructor(
    @InjectRepository(Banner)
    private readonly bannerRepository: Repository<Banner>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly paginationService: PaginationService,
  ) {}

  async create(createBannerDto: CreateBannerDto, user: User): Promise<Banner> {
    if (createBannerDto.mediaId) {
      const media = await this.mediaRepository.findOne({
        where: { id: createBannerDto.mediaId },
      });

      if (!media) {
        throw new NotFoundException(
          `Media with ID "${createBannerDto.mediaId}" not found.`,
        );
      }
    }
    const banner = this.bannerRepository.create({
      ...createBannerDto,
      createdById: user.id,
    });
    return this.bannerRepository.save(banner);
  }

  async list(query: PaginationQueryDto): Promise<CollectionResponseDto<Banner>> {
    const params = this.paginationService.normalizeParams(query);
    const { skip, take } = params;

    const [data, total] = await this.bannerRepository.findAndCount({
      order: {
        isPinned: 'DESC',
        pinnedOrder: 'ASC',
        createdAt: 'DESC',
      },
      skip,
      take,
    });

    return this.paginationService.createResponse(data, total, query);
  }

  async togglePin(id: string): Promise<Banner> {
    const banner = await this.findOne(id);
    banner.isPinned = !banner.isPinned;
    return this.bannerRepository.save(banner);
  }

  async reorderPins(dto: ReorderPinnedDto): Promise<void> {
    const updatePromises = dto.items.map((item) =>
      this.bannerRepository.update(item.id, {
        pinnedOrder: item.pinnedOrder,
        isPinned: true,
      }),
    );
    await Promise.all(updatePromises);
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
