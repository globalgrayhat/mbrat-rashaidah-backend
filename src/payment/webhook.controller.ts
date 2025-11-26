/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DonationsService } from '../donations/donations.service';
// Payment method validation is no longer needed - providers handle their own payment methods
import { MyFatooraWebhookEvent } from './common/interfaces/payment-service.interface';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly donationsService: DonationsService) {}

  @Post('myfatoora')
  async handleMyFatooraWebhook(@Body() event: MyFatooraWebhookEvent) {
    try {
      this.logger.log('Received MyFatoorah webhook event', {
        event: event.Event,
        invoiceId: event.Data?.InvoiceId || event.InvoiceId,
      });

      // Extract payment method ID from webhook event if available
      const data = event.Data ?? event;
      const paymentMethodId =
        (data as any)?.Payments?.[0]?.PaymentMethodId ||
        (data as any)?.PaymentMethodId;

      // Log payment method for monitoring
      if (paymentMethodId) {
        this.logger.debug(
          `Webhook received for payment method: ${paymentMethodId}`,
        );
      }

      // Pass empty array - payment methods are provider-specific and validated by provider
      const paymentMethods: string[] = [];

      await this.donationsService.handlePaymentWebhook(paymentMethods, event);

      this.logger.log('MyFatoorah webhook processed successfully', {
        invoiceId: event.Data?.InvoiceId || event.InvoiceId,
      });

      return { received: true, success: true };
    } catch (error: unknown) {
      let message = 'Unknown error';
      if (error && typeof error === 'object' && 'message' in error) {
        message = String((error as { message: unknown }).message);
      } else if (typeof error === 'string') {
        message = error;
      }

      this.logger.error(
        `MyFatoora webhook error: ${message}`,
        error instanceof Error ? error.stack : undefined,
        {
          event: JSON.stringify(event),
        },
      );

      throw new BadRequestException(message);
    }
  }
}
