import { Repository } from 'typeorm';
import { Banner } from './entities/banner.entity';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
export declare class BannersService {
    private readonly bannerRepository;
    constructor(bannerRepository: Repository<Banner>);
    create(createBannerDto: CreateBannerDto, userId: string): Promise<Banner>;
    findAll(): Promise<Banner[]>;
    findOne(id: string): Promise<Banner>;
    update(id: string, updateBannerDto: UpdateBannerDto): Promise<Banner>;
    remove(id: string): Promise<void>;
}
