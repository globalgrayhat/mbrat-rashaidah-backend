import { Injectable } from '@nestjs/common';
import { AppConfigService } from './config/config.service';
import { HomeFeedService } from './common/home-feed.service';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: AppConfigService,
    private readonly homeFeedService: HomeFeedService,
  ) {}

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

  getHomeFeed(limit = 10, offset = 0) {
    return this.homeFeedService.getFeed(limit, offset);
  }
}
