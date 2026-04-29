import { Module } from '@nestjs/common';
import { HomeFeedService } from '../common/home-feed.service';
import { ProjectsModule } from '../projects/projects.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [ProjectsModule, CampaignsModule, MediaModule],
  providers: [HomeFeedService],
  exports: [HomeFeedService],
})
export class HomeModule {}
