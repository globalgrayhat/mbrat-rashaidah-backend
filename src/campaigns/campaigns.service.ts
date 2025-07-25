import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CreateCampaignDto } from './dto/createCampaignDto';
import { UpdateCampaignDto } from './dto/UpdateCampaignDto';
import { Category } from '../categories/entities/category.entity';
import { Media } from '../media/entities/media.entity';
import { CampaignStatus } from '../common/constants/campaignStatus.constant';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  private async ensureEntityExists<T extends { id: string }>(
    repo: Repository<T>,
    id: string,
    entityName: string,
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const entity = await repo.findOne({ where: { id: id as any } });
    if (!entity) {
      throw new NotFoundException(`${entityName} with ID "${id}" not found.`);
    }
    return entity;
  }

  private async ensureSlugUnique(slug: string): Promise<void> {
    const existing = await this.campaignRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Slug "${slug}" is already in use.`);
    }
  }

  async create(createCampaignDto: CreateCampaignDto): Promise<Campaign> {
    const {
      title,
      slug,
      categoryId,
      mediaIds = [],
      ...otherFields
    } = createCampaignDto;

    await this.ensureSlugUnique(slug);
    await this.ensureEntityExists(
      this.categoryRepository,
      categoryId,
      'Category',
    );

    const campaign = this.campaignRepository.create({
      title,
      slug,
      categoryId,
      ...otherFields,
      currentAmount: otherFields.currentAmount ?? 0,
      donationCount: 0,
      viewCount: 0,
      status: otherFields.status ?? CampaignStatus.DRAFT,
      isActive: otherFields.isActive ?? true,
      isDonationActive: otherFields.isDonationActive ?? true,
      isProgressActive: otherFields.isProgressActive ?? true,
      isTargetAmountActive: otherFields.isTargetAmountActive ?? true,
    });

    if (mediaIds.length > 0) {
      const medias = await this.mediaRepository.findByIds(mediaIds);
      if (medias.length !== mediaIds.length) {
        throw new NotFoundException(`One or more media items not found.`);
      }
      campaign.media = medias;
    }

    try {
      return await this.campaignRepository.save(campaign);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException(`Campaign slug "${slug}" already exists.`);
      }
      throw err;
    }
  }

  async findAll(): Promise<Campaign[]> {
    return this.campaignRepository.find({
      relations: ['category', 'media'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['category', 'media'],
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${id}" not found.`);
    }
    return campaign;
  }

  async update(
    id: string,
    updateCampaignDto: UpdateCampaignDto,
  ): Promise<Campaign> {
    const campaign = await this.findOne(id);

    if (updateCampaignDto.slug && updateCampaignDto.slug !== campaign.slug) {
      await this.ensureSlugUnique(updateCampaignDto.slug);
    }

    if (updateCampaignDto.categoryId) {
      await this.ensureEntityExists(
        this.categoryRepository,
        updateCampaignDto.categoryId,
        'Category',
      );
    }

    Object.assign(campaign, updateCampaignDto);

    if (updateCampaignDto.mediaIds) {
      const medias = await this.mediaRepository.findByIds(
        updateCampaignDto.mediaIds,
      );
      const foundIds = medias.map((m) => m.id);
      const missingIds = updateCampaignDto.mediaIds.filter(
        (mid) => !foundIds.includes(mid),
      );
      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Media items not found: ${missingIds.join(', ')}`,
        );
      }
      campaign.media = medias;
    }

    try {
      return await this.campaignRepository.save(campaign);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException(
          `Campaign slug "${updateCampaignDto.slug}" already exists.`,
        );
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.campaignRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Campaign with ID "${id}" not found.`);
    }
  }

  async findByCategory(categoryId: string): Promise<Campaign[]> {
    return this.campaignRepository.find({
      where: { categoryId },
      relations: ['category', 'media'],
      order: { createdAt: 'DESC' },
    });
  }

  async findCampaignList(status: CampaignStatus): Promise<Campaign[]> {
    return this.campaignRepository.find({
      where: { status },
      relations: ['category', 'media'],
      order: { createdAt: 'DESC' },
    });
  }

  async findCampaignDetails(campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['category', 'media'],
    });
    if (!campaign) {
      throw new NotFoundException(
        `Campaign with ID "${campaignId}" not found.`,
      );
    }
    return campaign;
  }

  async getCampaignStats(): Promise<{
    total: number;
    active: number;
    byCategory: { categoryId: string; count: number }[];
  }> {
    const [total, active, byCategory] = await Promise.all([
      this.campaignRepository.count(),
      this.campaignRepository.count({ where: { isActive: true } }),
      this.campaignRepository
        .createQueryBuilder('campaign')
        .select('campaign.categoryId', 'categoryId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('campaign.categoryId')
        .getRawMany(),
    ]);

    return {
      total,
      active,
      byCategory: byCategory.map(
        (item: { categoryId: unknown; count: unknown }) => ({
          categoryId: String(item.categoryId),
          count: Number(item.count),
        }),
      ),
    };
  }
}
