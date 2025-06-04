// [FIXED 2025-06-04] Media Controller – Unified Upload Implementation

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Res,
  StreamableFile,
  BadRequestException,

} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { MediaService } from './media.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaType } from './entities/media.entity';
import { MimeTypesValidator } from '../common/validators/mime-types.validator';

@Controller('media')
export class MediaController {

  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new MimeTypesValidator({
            types: [
              'image/png',
              'image/jpeg',
              'image/jpg',
              'image/gif',
              'application/pdf',
            ],
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }


    
    // Convert file to Base64
    const base64Data = file.buffer.toString('base64');
    
    // Create media DTO
    const createMediaDto: CreateMediaDto = {
      data: base64Data,
      mimeType: file.mimetype,
      size: file.size,
      type: this.getMediaTypeFromMimeType(file.mimetype),
    };

    return await this.mediaService.create(createMediaDto);
  }

  @Get()
  findAll() {
    return this.mediaService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.mediaService.findOne(id);
  }

  @Get(':id/data')
  async getMediaData(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const media = await this.mediaService.findOne(id);
    
    // Set appropriate headers
    res.set({
      'Content-Type': media.mimeType,
      'Content-Length': media.size.toString(),
    });

    // Convert Base64 to Buffer and return as stream
    const buffer = Buffer.from(media.data, 'base64');
    return new StreamableFile(buffer);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMediaDto: UpdateMediaDto) {
    return this.mediaService.update(id, updateMediaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }

  private getMediaTypeFromMimeType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) {
      return MediaType.IMAGE;
    } else if (mimeType.startsWith('video/')) {
      return MediaType.VIDEO;
    } else if (mimeType.startsWith('audio/')) {
      return MediaType.AUDIO;
    } else {
      return MediaType.DOCUMENT;
    }
  }
}
