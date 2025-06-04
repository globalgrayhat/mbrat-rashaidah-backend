// mime-types.validator.ts
import { FileValidator } from '@nestjs/common';

/** Validates file.mimetype against an allowed list (case-insensitive) */
export class MimeTypesValidator extends FileValidator<{ types: string[] }> {
  isValid(file: Express.Multer.File): boolean {
    // drop anything after semicolon e.g.  image/png; charset=binary
    const clean = file.mimetype.split(';')[0].toLowerCase();
    return this.validationOptions.types
      .map((t) => t.toLowerCase())
      .includes(clean);
  }

  buildErrorMessage(): string {
    return 'Invalid file type. Only JPEG, PNG, GIF images and PDF documents are allowed.';
  }
}
