import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { User } from '../user/entities/user.entity';
import { CreateCampaignDto } from './dto/createCampaignDto';
import { UpdateCampaignDto } from './dto/UpdateCampaignDto';
export declare class CampaignsService {
    private readonly campaignRepo;
    private readonly userRepo;
    constructor(campaignRepo: Repository<Campaign>, userRepo: Repository<User>);
    getCampaigns(search: string, purpose: string, page: number, CAMPAIGNS_PER_PAGE: number): Promise<Campaign[]>;
    addCampaign(createCampaignDto: CreateCampaignDto, userId: string): Promise<Campaign>;
    getCampaign(id: string): Promise<Campaign>;
    editCampaign(id: string, UpdateCampaignDto: UpdateCampaignDto): Promise<Campaign>;
    deleteCampaign(id: string): Promise<string>;
}
