import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';
import { OutboxService } from './services/outbox.service';
import { OutboxProcessorService } from './services/outbox-processor.service';
import { PaymentModule } from '../../payment/payment.module';
import { Donation } from '../../donations/entities/donation.entity';
import { Payment } from '../../payment/entities/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent, Donation, Payment]),
    forwardRef(() => PaymentModule),
  ],
  providers: [OutboxService, OutboxProcessorService],
  exports: [OutboxService, OutboxProcessorService, TypeOrmModule],
})
export class OutboxModule {}
