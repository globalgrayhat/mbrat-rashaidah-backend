import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { CampaignExistsPipe } from './campaignExists.pipe';
import { DonorExistsPipe } from './donorExists.pipe';
import { DonationExistsPipe } from './donationExists.pipe';
import { ProjectExistsPipe } from './projectExists.pipe';
import { Donation } from '../../donations/entities/donation.entity';
import { Project } from '../../projects/entities/project.entity';
import { Donor } from '../../donor/entities/donor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, Donor, Donation, Project])],
  providers: [
    CampaignExistsPipe,
    DonorExistsPipe,
    DonationExistsPipe,
    ProjectExistsPipe,
  ],
  exports: [
    CampaignExistsPipe,
    DonorExistsPipe,
    DonationExistsPipe,
    ProjectExistsPipe,
  ],
})
export class CommonPipesModule {}
