import { Module } from '@nestjs/common';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation } from './entities/donation.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { User } from '../user/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectsModule } from '../projects/projects.module';
import { AnonymousDonor } from './entities/anonymous-donor.entity';
import { Payment } from '../payment/entities/payment.entity';
import { MyFatooraService } from '../payment/myfatoora.service';

@Module({
  imports: [
    ProjectsModule,
    TypeOrmModule.forFeature([
      Donation,
      Campaign,
      User,
      Project,
      AnonymousDonor,
      Payment,
    ]),
  ],
  controllers: [DonationsController],
  providers: [DonationsService, MyFatooraService],
  exports: [DonationsService],
})
export class DonationsModule {}
