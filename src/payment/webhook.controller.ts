import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DonationsService } from '../donations/donations.service';
import { PaymentMethodEnum } from '../common/constants/payment.constant';
import { MyFatooraWebhookEvent } from '../common/interfaces/payment-service.interface';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly donationsService: DonationsService) {}

  @Post('myfatoora')
  async handleMyFatooraWebhook(@Body() event: MyFatooraWebhookEvent) {
    try {
      const paymentMethods = [PaymentMethodEnum.VISA, PaymentMethodEnum.KNET];
      await this.donationsService.handlePaymentWebhook(paymentMethods, event);
      return { received: true };
    } catch (error: unknown) {
      let message = 'Unknown error';
      if (error && typeof error === 'object' && 'message' in error) {
        message = String((error as { message: unknown }).message);
      } else if (typeof error === 'string') {
        message = error;
      }

      this.logger.error(
        `MyFatoora webhook error: ${message}`,
        (error as Error).stack,
      );

      throw new BadRequestException(message);
    }
  }
}
