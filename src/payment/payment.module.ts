import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyFatooraService } from './myfatoora.service';
import { Payment } from './entities/payment.entity';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/config.service';
import { CurrencyService } from '../common/services/currency.service';
import { NotificationService } from '../common/services/notification.service';
import { TransactionLoggerService } from '../common/services/transaction-logger.service';
import { PaymentMethodsController } from './payment-methods.controller';
import { WebhookController } from './webhook.controller';
import { DonationsModule } from '../donations/donations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    AppConfigModule,
    forwardRef(() => DonationsModule), // Use forwardRef to handle circular dependency
  ],
  controllers: [PaymentMethodsController, WebhookController],
  providers: [
    MyFatooraService,
    AppConfigService,
    CurrencyService,
    NotificationService,
    TransactionLoggerService,
  ],
  exports: [
    MyFatooraService,
    CurrencyService,
    NotificationService,
    TransactionLoggerService,
  ],
})
export class PaymentModule {}
