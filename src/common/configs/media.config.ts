import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MediaConfigService {
  constructor(private configService: ConfigService) {}

  get uploadDir(): string {
    return this.configService.get<string>('UPLOAD_DIR', 'uploads');
  }

  get maxFileSize(): number {
    return this.configService.get<number>('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB default
  }

  get allowedMimeTypes(): string[] {
    const defaultTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
    ];
    const configTypes = this.configService.get<string>('ALLOWED_MIME_TYPES');
    return configTypes ? configTypes.split(',') : defaultTypes;
  }

  get maxFilenameLength(): number {
    return this.configService.get<number>('MAX_FILENAME_LENGTH', 255);
  }

  get useCloudStorage(): boolean {
    return this.configService.get<boolean>('USE_CLOUD_STORAGE', false);
  }

  get cloudinaryConfig() {
    return {
      cloudName: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      apiKey: this.configService.get<string>('CLOUDINARY_API_KEY'),
      apiSecret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    };
  }
}
