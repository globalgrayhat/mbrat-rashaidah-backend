// [FIXED 2025-06-04] File Size Validation Pipe

import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
  constructor(private readonly maxSize: number) {}

  transform(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.size > this.maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.maxSize / (1024 * 1024)}MB`,
      );
    }

    return file;
  }
} 