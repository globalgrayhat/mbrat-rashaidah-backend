import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Media } from './entities/media.entity';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { PaginationService } from '../common/pagination/pagination.service';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { CollectionResponseDto } from '../common/pagination/dto/collection-response.dto';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly paginationService: PaginationService,
  ) {}

  async create(createMediaDto: CreateMediaDto): Promise<Media> {
    const media = this.mediaRepository.create({
      ...createMediaDto,
      isActive: createMediaDto.isActive ?? true,
      displayOrder: createMediaDto.displayOrder ?? 0,
    });
    return await this.mediaRepository.save(media);
  }

  async list(query: PaginationQueryDto): Promise<CollectionResponseDto<Media>> {
    const params = this.paginationService.normalizeParams(query);
    const { skip, take, search } = params;

    const queryBuilder = this.mediaRepository.createQueryBuilder('media');

    if (search) {
      queryBuilder.andWhere(
        '(media.name LIKE :search OR media.path LIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder
      .orderBy(`media.${query.sortBy || 'createdAt'}`, query.sortOrder || 'DESC');

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return this.paginationService.createResponse(data, total, query);
  }

  async findAll(): Promise<Media[]> {
    return await this.mediaRepository.find({
      order: {
        displayOrder: 'ASC',
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Media> {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);
    return media;
  }

  async update(id: string, updateMediaDto: UpdateMediaDto): Promise<Media> {
    const media = await this.findOne(id);
    Object.assign(media, updateMediaDto);
    return await this.mediaRepository.save(media);
  }

async remove(id: string): Promise<void> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      relations: ['projects', 'campaigns'],
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    // 1. Clear relations via Raw SQL to satisfy all foreign key constraints
    // We target both the current tables and the legacy 'project_media' table mentioned in errors
    const tablesToClear = ['project_media_items', 'campaign_media_items', 'project_media', 'campaign_media'];
    
    for (const table of tablesToClear) {
      try {
        await this.mediaRepository.query(`DELETE FROM ${table} WHERE mediaId = ?`, [id]);
      } catch (err) {
        // Ignore errors if table doesn't exist
      }
    }

    // 2. Delete the physical file from disk
    if (media.path) {
      const filePath = path.join(process.cwd(), media.path);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`Failed to delete file ${filePath}:`, err.message);
      }
    }

    // 3. Finally remove the record from database
    await this.mediaRepository.delete(id);
  }

  async bulkRemove(ids: string[]): Promise<{ deletedCount: number; failedIds: string[] }> {
    let deletedCount = 0;
    const failedIds: string[] = [];

    for (const id of ids) {
      try {
        await this.remove(id);
        deletedCount++;
      } catch (err) {
        failedIds.push(id);
      }
    }

    return { deletedCount, failedIds };
  }

  async fixAllEncodings(): Promise<{ fixedCount: number }> {
    const allMedia = await this.mediaRepository.find();
    let fixedCount = 0;

    for (const media of allMedia) {
      const original = media.name;
      // Heuristic: check for common garbled Arabic patterns (Ø, Ù, etc.)
      if (
        original &&
        (original.includes('Ø') ||
          original.includes('Ù') ||
          original.includes('Ø§'))
      ) {
        try {
          const fixed = Buffer.from(original, 'latin1').toString('utf8');
          // Only save if it actually changed and is different from original
          if (fixed !== original && !fixed.includes('')) {
            media.name = fixed;
            await this.mediaRepository.save(media);
            fixedCount++;
          }
        } catch (e) {
          // ignore failures for specific records
        }
      }
    }

    return { fixedCount };
  }
}
