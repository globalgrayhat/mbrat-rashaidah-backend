import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
export declare class BannersController {
    private readonly bannersService;
    constructor(bannersService: BannersService);
    create(createBannerDto: CreateBannerDto, req: any): Promise<import("./entities/banner.entity").Banner>;
    findAll(): Promise<import("./entities/banner.entity").Banner[]>;
    findOne(id: string): Promise<import("./entities/banner.entity").Banner>;
    update(id: string, updateBannerDto: UpdateBannerDto): Promise<import("./entities/banner.entity").Banner>;
    remove(id: string): Promise<void>;
}
