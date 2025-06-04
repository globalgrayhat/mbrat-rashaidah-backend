// [FIXED 2025-06-04] Media Service – Base64 Storage Implementation

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media, MediaType } from './entities/media.entity';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
  ) {}

  async create(file: Express.Multer.File): Promise<Media> {
    // Determine media type based on file mime type
    let type: MediaType;
    if (file.mimetype.startsWith('image/')) {
      type = MediaType.IMAGE;
    } else if (file.mimetype.startsWith('video/')) {
      type = MediaType.VIDEO;
    } else if (file.mimetype.startsWith('audio/')) {
      type = MediaType.AUDIO;
    } else {
      type = MediaType.DOCUMENT;
    }

    // Convert file buffer to Base64
    const base64Data = file.buffer.toString('base64');

    // Create media entity
    const media = this.mediaRepo.create({
      data: base64Data,
      type,
      mimeType: file.mimetype,
      size: file.size,
    });

    return await this.mediaRepo.save(media);
  }

  async findOne(id: string): Promise<Media> {
    const media = await this.mediaRepo.findOne({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }
    return media;
  }

  async remove(id: string): Promise<void> {
    const result = await this.mediaRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }
  }
} 