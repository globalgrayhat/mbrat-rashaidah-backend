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
  Res,
  StreamableFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { MediaService } from './media.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaType } from '../common/constants/media.constant';
import { MimeTypesValidator } from '../common/validators/mime-types.validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import * as fs from 'fs';
import * as path from 'path';

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // Max 10MB
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
    if (!file) throw new BadRequestException('No file uploaded');

    const uploadDir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });

    const uniqueFileName = file.originalname; // You can add UUID if needed
    const filePath = path.join(uploadDir, uniqueFileName);

    fs.writeFileSync(filePath, file.buffer);

    const createMediaDto: CreateMediaDto = {
      name: file.originalname,
      path: `uploads/${uniqueFileName}`,
      mimeType: file.mimetype,
      size: file.size,
      type: this.getMediaTypeFromMimeType(file.mimetype),
    };

    return this.mediaService.create(createMediaDto);
  }

  @Get()
  findAll() {
    return this.mediaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Get(':id/data')
  async getMediaData(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const media = await this.mediaService.findOne(id);
    const filePath = path.join(process.cwd(), media.path);

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('File not found on server');
    }

    const stream = fs.createReadStream(filePath);

    res.set({
      'Content-Type': media.mimeType,
      'Content-Length': media.size.toString(),
    });

    return new StreamableFile(stream);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Param('id') id: string, @Body() updateMediaDto: UpdateMediaDto) {
    return this.mediaService.update(id, updateMediaDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }

  private getMediaTypeFromMimeType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return MediaType.IMAGE;
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return MediaType.AUDIO;
    return MediaType.DOCUMENT;
  }
}
