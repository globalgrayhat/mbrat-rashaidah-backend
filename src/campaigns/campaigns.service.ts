// [FIXED 2025-06-04]
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignStatusEnum } from '../common/constants/campaignStatus.constant'; 
import { User } from '../user/entities/user.entity';
import { CreateCampaignDto } from './dto/createCampaignDto';
import { UpdateCampaignDto } from './dto/UpdateCampaignDto';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // Get paginated campaigns with search and purpose filter
  async getCampaigns(
    search: string,
    purpose: string,
    page: number,
    CAMPAIGNS_PER_PAGE: number,
  ) {
    const where: Record<string, any> = {};
    if (search) where.name = ILike(`%${search.trim().toLowerCase()}%`);
    if (purpose) where.purpose = purpose;
    const CampaignsCount = await this.campaignRepo.count({ where });
    const totalPagesCount = Math.ceil(CampaignsCount / CAMPAIGNS_PER_PAGE);
    if (page > totalPagesCount && totalPagesCount > 0) {
      throw new BadRequestException(
        `only pages between 1 and ${totalPagesCount} allowed`,
      );
    }
    const campaigns = await this.campaignRepo.find({
      where,
      relations: ['official'],
      select: [
        'id',
        'name',
        'amountRequired',
        'amountLeft',
        'purpose',
        'campaignStatus',
      ],
      skip: (page - 1) * CAMPAIGNS_PER_PAGE,
      take: CAMPAIGNS_PER_PAGE,
    });
    return campaigns;
  }

  // Add a new campaign, only for verified users
  async addCampaign(createCampaignDto: CreateCampaignDto, userId: string) {
    const official = await this.userRepo.findOne({ where: { id: userId } });
    if (!official || !official.isVerified) {
      throw new UnauthorizedException('not verified user');
    }
    try {
      const newCampaign = this.campaignRepo.create({
        ...createCampaignDto,
        officialId: userId,
        amountLeft: createCampaignDto.amountRequired,
        amountRaised: 0,
        campaignStatus: CampaignStatusEnum.ACTIVE,
      });
      await this.campaignRepo.save(newCampaign);
      return newCampaign;
    } catch {
      throw new InternalServerErrorException('Failed to create campaign');
    }
  }

  // Get a single campaign with official and successful donations
  async getCampaign(id: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id },
      relations: ['official'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    // Donations logic would be handled in a separate service or with a custom query
    return campaign;
  }

  // Edit campaign
  async editCampaign(id: string, UpdateCampaignDto: UpdateCampaignDto) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    Object.assign(campaign, UpdateCampaignDto);
    await this.campaignRepo.save(campaign);
    return campaign;
  }

  // Delete only COMPLETED campaigns
  async deleteCampaign(id: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id, campaignStatus: CampaignStatusEnum.COMPLETED },
    });
    if (!campaign) {
      throw new ForbiddenException(
        'only COMPLETED campaigns are allowed to be deleted',
      );
    }
    await this.campaignRepo.remove(campaign);
    return `Campaign ${campaign.name} was deleted successfully!`;
  }
}
