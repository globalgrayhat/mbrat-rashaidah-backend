import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from './entities/media.entity';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
  ) {}

  create(createMediaDto: CreateMediaDto) {
    const media = this.mediaRepository.create(createMediaDto);
    return this.mediaRepository.save(media);
  }

  findAll() {
    return this.mediaRepository.find();
  }

  findOne(id: string) {
    return this.mediaRepository.findOne({ where: { id } });
  }

  update(id: string, updateMediaDto: UpdateMediaDto) {
    return this.mediaRepository.update(id, updateMediaDto);
  }

  remove(id: string) {
    return this.mediaRepository.delete(id);
  }
}
