import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyFatooraService } from './myfatoora.service';
// import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { Donation } from '../donations/entities/donation.entity';
import { DonationsService } from '../donations/donations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Donation])],
  providers: [MyFatooraService, DonationsService],
  // exports: [PaymentService],
})
export class PaymentModule {}
