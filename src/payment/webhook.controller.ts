/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// External dependency - remove when migrating to another project
// This webhook controller is specific to the donations project
// When migrating, you should create your own webhook handler
// that works with your order/donation entities
// See MIGRATION_IMPORTS_FIX.md for instructions
import { DonationsService } from '../donations/donations.service';
// Payment method validation is no longer needed - providers handle their own payment methods
import { MyFatooraWebhookEvent } from './common/interfaces/payment-service.interface';
import { Payment } from './entities/payment.entity';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  // DonationsService - Remove this dependency when migrating
  // Create your own webhook handler that works with your entities
  constructor(
    private readonly donationsService: DonationsService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

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

      // ── Store customer info from webhook (non-blocking) ──
      // This enriches the local Payment record with customer data
      // so the InvoiceController can return it without hitting MyFatoorah.
      this.storeCustomerInfoFromWebhook(data).catch((err) => {
        this.logger.warn(
          `Non-critical: failed to store customer info from webhook: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });

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

  /**
   * Store customer info from webhook payload onto the local Payment record.
   * Non-blocking — errors are caught by the caller.
   */
  private async storeCustomerInfoFromWebhook(data: any): Promise<void> {
    const invoiceId = String(data?.InvoiceId);
    if (!invoiceId || invoiceId === 'undefined') return;

    const customerName = data?.CustomerName as string | undefined;
    const customerEmail = data?.CustomerEmail as string | undefined;
    const customerMobile = data?.CustomerMobile as string | undefined;

    // Only update if we have at least one piece of customer info
    if (!customerName && !customerEmail && !customerMobile) return;

    const payment = await this.paymentRepository.findOne({
      where: { transactionId: invoiceId },
    });
    if (!payment) return;

    // Only fill in missing fields — never overwrite existing data
    const updates: Partial<Payment> = {};
    if (!payment.customerName && customerName)
      updates.customerName = customerName;
    if (!payment.customerEmail && customerEmail)
      updates.customerEmail = customerEmail;
    if (!payment.customerMobile && customerMobile)
      updates.customerMobile = customerMobile;

    if (Object.keys(updates).length > 0) {
      await this.paymentRepository.update(payment.id, updates);
      this.logger.debug(
        `Stored customer info for invoice ${invoiceId}: ${Object.keys(updates).join(', ')}`,
      );
    }
  }
}
