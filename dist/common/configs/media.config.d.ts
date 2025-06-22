import { ConfigService } from '@nestjs/config';
export declare class MediaConfigService {
    private configService;
    constructor(configService: ConfigService);
    get uploadDir(): string;
    get maxFileSize(): number;
    get allowedMimeTypes(): string[];
    get maxFilenameLength(): number;
    get useCloudStorage(): boolean;
    get cloudinaryConfig(): {
        cloudName: string | undefined;
        apiKey: string | undefined;
        apiSecret: string | undefined;
    };
}
