import { FileValidator } from '@nestjs/common';
export declare class MimeTypesValidator extends FileValidator<{
    types: string[];
}> {
    isValid(file: Express.Multer.File): boolean;
    buildErrorMessage(): string;
}
