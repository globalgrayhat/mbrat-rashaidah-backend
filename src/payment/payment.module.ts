import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyFatooraService } from './myfatoora.service';
import { Payment } from './entities/payment.entity';
import { Donation } from '../donations/entities/donation.entity';
import { DonationsService } from '../donations/donations.service';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/config.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Donation]), AppConfigModule],
  providers: [MyFatooraService, DonationsService, AppConfigService],
  exports: [MyFatooraService],
})
export class PaymentModule {}
