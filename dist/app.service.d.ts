import { AppConfigService } from './config/config.service';
export declare class AppService {
    private readonly configService;
    constructor(configService: AppConfigService);
    getHealth(): {
        status: string;
        message: string;
        appName: string;
    };
}
