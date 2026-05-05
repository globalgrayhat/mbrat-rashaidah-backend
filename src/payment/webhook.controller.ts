/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
// External dependency - remove when migrating to another project
// This webhook controller is specific to the donations project
// When migrating, you should create your own webhook handler
// that works with your order/donation entities
// See MIGRATION_IMPORTS_FIX.md for instructions
import { DonationsService } from '../donations/donations.service';
// Payment method validation is no longer needed - providers handle their own payment methods
import { MyFatooraWebhookEvent } from './common/interfaces/payment-service.interface';
import { Payment } from './entities/payment.entity';
import { Public } from '../common/decorators/public.decorator';

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

  @Public()
  @Post('myfatoorah')
  async handleMyFatoorahWebhook(
    @Body() event: MyFatooraWebhookEvent,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    return this.processWebhook(event, headers, req);
  }

  @Public()
  @Post('myfatoora')
  async handleMyFatooraWebhookLegacy(
    @Body() event: MyFatooraWebhookEvent,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    return this.processWebhook(event, headers, req);
  }

  private async processWebhook(
    event: MyFatooraWebhookEvent,
    headers: Record<string, string>,
    req?: any,
  ) {
    try {
      const invoiceId = this.extractInvoiceId(event);

      this.logger.log('Received MyFatoorah webhook event', {
        event: event.Event?.Name || (event as any).Event,
        invoiceId,
      });

      // 1. Verify Signature
      this.verifySignatureOrThrow(event, headers, req);

      // 2. Call service logic
      const result = await this.donationsService.handlePaymentWebhook([], event);

      // 3. Store customer info (non-blocking)
      const data = event.Data ?? event;
      this.storeCustomerInfoFromWebhook(data).catch((err) => {
        this.logger.warn(
          `Non-critical: failed to store customer info from webhook: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });

      this.logger.log('MyFatoorah webhook processed successfully', {
        invoiceId,
        success: result?.success,
        reason: result?.reason,
      });

      // 4. Handle Result
      if (result?.skipped) {
        // Known business skip - return 200
        return {
          ...result,
          received: true,
          success: result.success ?? true,
        };
      }

      return {
        ...result,
        received: true,
        success: result?.success ?? true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`MyFatoora webhook error: ${message}`, {
        invoiceId: this.extractInvoiceId(event),
        error: error instanceof Error ? error.stack : undefined,
      });

      // Rethrow real errors so MyFatoorah can retry
      // This is important for database failures or other system issues
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Verify MyFatoorah webhook signature
   * @param event The webhook payload
   * @param headers HTTP headers
   * @param req The request object (to access rawBody)
   */
  private verifySignatureOrThrow(
    event: MyFatooraWebhookEvent,
    headers: Record<string, string>,
    req?: any,
  ): void {
    const isRequired =
      process.env.MYFATOORAH_WEBHOOK_SIGNATURE_REQUIRED !== 'false';
    const secret = process.env.MYFATOORAH_WEBHOOK_SECRET;
    const signature = headers['myfatoorah-signature'];

    if (!isRequired) {
      this.logger.debug(
        'MyFatoorah webhook signature verification skipped (disabled in env)',
      );
      return;
    }

    if (!secret) {
      this.logger.error('MYFATOORAH_WEBHOOK_SECRET is not configured');
      throw new InternalServerErrorException(
        'Webhook verification failed: secret missing',
      );
    }

    if (!signature) {
      this.logger.warn('MyFatoorah webhook missing signature header');
      throw new InternalServerErrorException(
        'Webhook verification failed: signature missing',
      );
    }

    try {
      // Use rawBody if available (enabled in main.ts) for absolute accuracy
      // MyFatoorah calculates HMAC on the raw JSON string
      let payload: string | Buffer;

      if (req?.rawBody) {
        payload = req.rawBody;
      } else {
        // Fallback to JSON.stringify if rawBody is not enabled
        // Note: This might fail if the field order or whitespace differs from the gateway
        payload = JSON.stringify(event);
        this.logger.debug(
          'Using JSON.stringify for webhook verification (rawBody not found)',
        );
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64');

      if (signature !== expectedSignature) {
        this.logger.warn('MyFatoorah webhook signature mismatch', {
          received: signature,
          // Do not log expected signature or secret for security
        });
        throw new InternalServerErrorException(
          'Webhook verification failed: signature mismatch',
        );
      }
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;

      this.logger.error('Error during webhook signature verification', err);
      throw new InternalServerErrorException('Webhook verification failed');
    }
  }

  private extractInvoiceId(event: MyFatooraWebhookEvent): string | undefined {
    const data: any = event.Data ?? event;
    return (
      this.toNonEmptyString(data?.InvoiceId) ||
      this.toNonEmptyString(data?.Invoice?.Id) ||
      this.toNonEmptyString(event.InvoiceId) ||
      this.toNonEmptyString((event as any).EventEntityId)
    );
  }

  private toNonEmptyString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    if (!text) return undefined;
    const lowered = text.toLowerCase();
    if (['undefined', 'null', 'nan'].includes(lowered)) return undefined;
    return text;
  }

  /**
   * Store customer info from webhook payload onto the local Payment record.
   * Non-blocking — errors are caught by the caller.
   */
  private async storeCustomerInfoFromWebhook(data: any): Promise<void> {
    const invoiceId =
      this.toNonEmptyString(data?.InvoiceId) ||
      this.toNonEmptyString(data?.Invoice?.Id);

    if (!invoiceId) return;

    const customerName =
      this.toNonEmptyString(data?.CustomerName) ||
      this.toNonEmptyString(data?.Customer?.Name);
    const customerEmail =
      this.toNonEmptyString(data?.CustomerEmail) ||
      this.toNonEmptyString(data?.Customer?.Email);
    const customerMobile =
      this.toNonEmptyString(data?.CustomerMobile) ||
      this.toNonEmptyString(data?.Customer?.Mobile);

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

