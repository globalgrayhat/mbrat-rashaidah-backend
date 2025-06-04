import { Module } from '@nestjs/common';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { StripeModule } from '../stripe/stripe.module';
import { MyFatooraModule } from '../myfatoora/myfatoora.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation } from './entities/donation.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { User } from '../user/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    StripeModule,
    MyFatooraModule,
    ProjectsModule,
    TypeOrmModule.forFeature([Donation, Campaign, User, Project]),
  ],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}
