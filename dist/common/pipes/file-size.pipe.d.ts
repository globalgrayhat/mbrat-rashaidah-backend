import { PipeTransform } from '@nestjs/common';
export declare class FileSizeValidationPipe implements PipeTransform {
    private readonly maxSize;
    constructor(maxSize: number);
    transform(file: Express.Multer.File): Express.Multer.File;
}
