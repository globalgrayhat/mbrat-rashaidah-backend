import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/createCampaignDto';
import { UpdateCampaignDto } from './dto/UpdateCampaignDto';
export declare class CampaignsController {
    private readonly campaignsService;
    constructor(campaignsService: CampaignsService);
    getCampaigns(page: number, purpose: string, search: string): Promise<import("./entities/campaign.entity").Campaign[]>;
    addCampaign(req: any, createCampaignDto: CreateCampaignDto): Promise<import("./entities/campaign.entity").Campaign>;
    getCampaign(id: string): Promise<import("./entities/campaign.entity").Campaign>;
    editCampaign(id: string, UpdateCampaignDto: UpdateCampaignDto): Promise<import("./entities/campaign.entity").Campaign>;
    deleteCampaign(id: string): Promise<string>;
}
