import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DonationsService } from '../donations/donations.service';
import { isSupportedPaymentMethod } from '../common/constants/payment.constant';
import { MyFatooraWebhookEvent } from '../common/interfaces/payment-service.interface';

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

      // Validate payment method if provided
      if (paymentMethodId && !isSupportedPaymentMethod(paymentMethodId)) {
        this.logger.warn(
          `Unsupported payment method ${paymentMethodId} in webhook, but processing anyway`,
        );
      }

      // Get all supported payment methods dynamically
      // Since we now support all MyFatoorah methods, we pass an empty array
      // and let the service validate based on the actual payment method in the event
      const paymentMethods: number[] = [];

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
