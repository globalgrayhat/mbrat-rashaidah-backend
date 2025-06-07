import { StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { MediaService } from './media.service';
import { UpdateMediaDto } from './dto/update-media.dto';
export declare class MediaController {
    private readonly mediaService;
    constructor(mediaService: MediaService);
    uploadFile(file: Express.Multer.File): Promise<import("./entities/media.entity").Media>;
    findAll(): Promise<import("./entities/media.entity").Media[]>;
    findOne(id: string): Promise<import("./entities/media.entity").Media>;
    getMediaData(id: string, res: Response): Promise<StreamableFile>;
    update(id: string, updateMediaDto: UpdateMediaDto): Promise<import("./entities/media.entity").Media>;
    remove(id: string): Promise<void>;
    private getMediaTypeFromMimeType;
}
