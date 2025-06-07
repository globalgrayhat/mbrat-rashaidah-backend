import { Injectable } from '@nestjs/common';
import { AppConfigService } from './config/config.service';

@Injectable()
export class AppService {
  constructor(private readonly configService: AppConfigService) {}

  getHealth(): {
    status: string;
    message: string;
    appName: string;
  } {
    const appName = this.configService.appName;

    return {
      status: 'ok',
      message: `${appName} backend is up and running smoothly.`,
      appName,
    };
  }
}
