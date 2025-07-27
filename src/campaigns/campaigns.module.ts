import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { Campaign } from './entities/campaign.entity';
import { User } from '../user/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { Media } from '../media/entities/media.entity';
import { CampaignExistsPipe } from '../common/pipes/campaignExists.pipe';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, User, Category, Media])],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignExistsPipe],
  exports: [CampaignsService, CampaignExistsPipe],
})
export class CampaignsModule {}
