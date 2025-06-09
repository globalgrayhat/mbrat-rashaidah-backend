import { Repository } from 'typeorm';
import { Media } from './entities/media.entity';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
export declare class MediaService {
    private readonly mediaRepository;
    constructor(mediaRepository: Repository<Media>);
    create(createMediaDto: CreateMediaDto): Promise<Media>;
    findAll(): Promise<Media[]>;
    findOne(id: string): Promise<Media>;
    update(id: string, updateMediaDto: UpdateMediaDto): Promise<Media>;
    remove(id: string): Promise<void>;
}
