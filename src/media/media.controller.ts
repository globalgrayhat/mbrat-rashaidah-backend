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
  Query,
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
import { Public } from '../common/decorators/public.decorator';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

    // Fix encoding issues for filenames (e.g. Arabic names)
    // Multer sometimes parses UTF-8 filenames as Latin1
    try {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString(
        'utf8',
      );
    } catch (e) {
      // Fallback to original name if conversion fails
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });

    // Use UUID to prevent file name collisions
    const fileExt = path.extname(file.originalname);
    const uniqueFileName = `${uuidv4()}${fileExt}`;
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

  @Public()
  @Get('paginated')
  findAllPaginated(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.mediaService.findAllPaginated(parsedLimit, parsedOffset);
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

  @Post('fix-encoding')
  @Roles(Role.SUPER_ADMIN)
  async fixEncoding() {
    return this.mediaService.fixAllEncodings();
  }

  private getMediaTypeFromMimeType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return MediaType.IMAGE;
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return MediaType.AUDIO;
    return MediaType.DOCUMENT;
  }
}
