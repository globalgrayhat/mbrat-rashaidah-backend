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
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
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
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { ApiCollectionResponse } from '../common/pagination/decorators/api-collection-response.decorator';
import { Media } from './entities/media.entity';

@ApiTags('Media')
@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
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
    if (!file) throw new BadRequestException('No file uploaded');

    try {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {
      // Fallback
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });

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

  @ApiOperation({ summary: 'List all media with pagination' })
  @ApiCollectionResponse(Media)
  @Public()
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.mediaService.list(query);
  }

  @ApiOperation({ summary: 'Get media data (stream)' })
  @Public()
  @Get(':id/data')
  async getMediaData(
    @Param('id', ParseUUIDPipe) id: string,
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

  @ApiOperation({ summary: 'Update media details' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMediaDto: UpdateMediaDto,
  ) {
    return this.mediaService.update(id, updateMediaDto);
  }

  @ApiOperation({ summary: 'Delete media' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.remove(id);
  }

  @ApiOperation({ summary: 'Fix encoding issues for all media names' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  @Post('fix-encoding')
  async fixEncoding() {
    return this.mediaService.fixAllEncodings();
  }

  @ApiOperation({ summary: 'Get media by ID' })
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.findOne(id);
  }

  private getMediaTypeFromMimeType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return MediaType.IMAGE;
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return MediaType.AUDIO;
    return MediaType.DOCUMENT;
  }
}
