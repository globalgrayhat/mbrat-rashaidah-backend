import { Module, forwardRef } from '@nestjs/common';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation } from './entities/donation.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { User } from '../user/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectsModule } from '../projects/projects.module';
import { Payment } from '../payment/entities/payment.entity';
import { Donor } from '../donor/entities/donor.entity';
import { DonorModule } from '../donor/donor.module';
import { AppConfigModule } from '../config/config.module';
import { PaymentModule } from '../payment/payment.module';
import { CurrencyService } from '../payment/common/services/currency.service';
import { NotificationService } from '../common/services/notification.service';

@Module({
  imports: [
    ProjectsModule,
    DonorModule,
    forwardRef(() => PaymentModule), // Use forwardRef to handle circular dependency
    TypeOrmModule.forFeature([
      Donation,
      Campaign,
      User,
      Project,
      Payment,
      Donor,
    ]),
    AppConfigModule,
  ],
  controllers: [DonationsController],
  providers: [DonationsService, CurrencyService, NotificationService],
  exports: [DonationsService],
})
export class DonationsModule {}
