import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxService, DonationPaymentInitPayload } from './outbox.service';
import { OutboxStatus, OutboxEvent } from '../entities/outbox-event.entity';
import { PaymentService } from '../../../payment/payment.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Donation } from '../../../donations/entities/donation.entity';
import { Payment } from '../../../payment/entities/payment.entity';
import { createLocalPaymentForEntityFromResult } from '../../../payment/common/utils/payment.utils';

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  constructor(
    private readonly outboxService: OutboxService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    @InjectRepository(Donation)
    private readonly donationRepository: Repository<Donation>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Primary Recovery Mechanism: Cron job that runs every 5 minutes
   * Scans for PENDING outbox events that are older than 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleStuckEvents() {
    this.logger.debug('Starting Outbox Recovery scanning...');

    // Find events stuck in PENDING state for more than 5 minutes
    const stuckEvents = await this.outboxService.findStuckEvents(5);

    if (stuckEvents.length === 0) {
      return;
    }

    this.logger.warn(
      `Found ${stuckEvents.length} stuck outbox events needing reconciliation`,
    );

    for (const event of stuckEvents) {
      const correlationId = event.payload.correlationId || 'RECOVERY';
      
      // Step 1: Atomic Claim
      const claimed = await this.outboxService.claimEvent(event.id);
      if (!claimed) {
        this.logger.debug(`[${correlationId}] Event ${event.id} already claimed by another worker.`);
        continue;
      }

      try {
        await this.reconcileEvent(event, correlationId);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[${correlationId}] Recovery FAILED for event ${event.id}: ${errorMsg}`,
        );
        await this.outboxService.incrementRetry(event.id, errorMsg);
      }
    }
  }

  /**
   * Reconciles a single outbox event with the payment gateway and local database
   */
  private async reconcileEvent(event: OutboxEvent, correlationId: string) {
    const payload = event.payload as DonationPaymentInitPayload;
    const { donationIds, providerInvoiceId, transactionId, providerPaymentId } = payload;

    if (!donationIds || donationIds.length === 0) {
      await this.outboxService.markAsFailed(event.id, 'No donationIds in payload');
      return;
    }

    // Step 2: Check if already linked
    const donations = await this.donationRepository.find({
      where: { id: In(donationIds) },
    });

    if (donations.length === 0) {
      await this.outboxService.markAsFailed(event.id, 'Donations not found in database');
      return;
    }

    const linkedPaymentId = donations.find(d => d.paymentId)?.paymentId;
    if (linkedPaymentId) {
      this.logger.log(`[${correlationId}] Event ${event.id} already partially or fully linked. Ensuring consistency.`);
      const payment = await this.paymentRepository.findOne({ where: { id: linkedPaymentId } });
      if (payment) {
        await this.linkDonationsAndResolve(event, payment, donationIds, correlationId);
        return;
      }
    }

    // Step 3: Search for local payment by provider IDs
    // DO NOT search by donationId as it is not the InvoiceId
    const gatewayId = transactionId || providerInvoiceId || event.transactionId;
    
    if (gatewayId) {
      const existingPayment = await this.paymentRepository.findOne({
        where: [
          { transactionId: gatewayId },
          { mfPaymentId: providerPaymentId || gatewayId }
        ],
      });

      if (existingPayment) {
        this.logger.log(`[${correlationId}] Payment ${existingPayment.transactionId} found locally. Linking.`);
        await this.linkDonationsAndResolve(event, existingPayment, donationIds, correlationId);
        return;
      }
    }

    // Step 4: Verify with Gateway if we have an ID
    if (!gatewayId) {
      this.logger.warn(`[${correlationId}] No provider reference found in outbox ${event.id}. Cannot safely recover without creating duplicate.`);
      await this.outboxService.markAsManualReview(event.id, 'Missing provider reference; gateway check impossible');
      return;
    }

    const providerName = this.paymentService.getActiveProviderName();
    const keyType =
      providerPaymentId && gatewayId === providerPaymentId
        ? 'PaymentId'
        : gatewayId.startsWith('07')
          ? 'PaymentId'
          : 'InvoiceId';

    this.logger.debug(
      `[${correlationId}] Reconciling with ${providerName} for ID ${gatewayId} (${keyType})`,
    );

    try {
      const statusResult = await this.paymentService.getPaymentStatus(
        gatewayId,
        keyType,
      );

      if (
        statusResult.outcome === 'paid' ||
        statusResult.outcome === 'pending'
      ) {
        this.logger.log(
          `[${correlationId}] Payment exists at gateway (${statusResult.outcome}). Creating local record.`,
        );

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();

        try {
          // Adapt statusResult to PaymentResult format for the utility
          const recoveredPaymentResult = {
            id: statusResult.transactionId,
            url: payload.paymentUrl || '',
            status: statusResult.outcome || 'pending',
            rawResponse: statusResult.raw,
            paymentId: statusResult.paymentId, // Pass this so utility can extract mfPaymentId
          };

          // Use the PURE utility to create record from existing result
          const { payment } = await createLocalPaymentForEntityFromResult(
            qr.manager.getRepository(Payment),
            {
              amount: statusResult.amount || payload.totalAmount,
              currency: statusResult.currency || payload.currency,
              customerName: 'Recovered Donor',
              paymentMethodId: payload.paymentMethod,
            },
            recoveredPaymentResult as any,
          );

          await qr.manager.update(
            Donation,
            { id: In(donationIds) },
            { paymentId: payment.id },
          );

          const success = await this.outboxService.markAsProcessed(
            event.id,
            payment.transactionId,
            qr.manager,
          );

          if (!success) throw new Error('Failed to mark outbox as processed');

          await qr.commitTransaction();
          this.logger.log(
            `[${correlationId}] Recovery successful for outbox ${event.id}`,
          );
        } catch (innerError) {
          await qr.rollbackTransaction();
          throw innerError;
        } finally {
          await qr.release();
        }
      } else if (statusResult.outcome === 'failed') {
        this.logger.warn(`[${correlationId}] Gateway returned FAILED for ${gatewayId}.`);
        await this.outboxService.markAsFailed(event.id, 'Payment failed at gateway');
      }
    } catch (gatewayError) {
      this.logger.error(`[${correlationId}] Gateway reconciliation failed: ${gatewayError.message}`);
      throw gatewayError; // Let incrementRetry handle it
    }
  }

  /**
   * Helper to link donations and resolve outbox for an existing payment
   */
  private async linkDonationsAndResolve(
    event: OutboxEvent,
    payment: Payment,
    donationIds: string[],
    correlationId: string,
  ) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Idempotent update
      await qr.manager.update(
        Donation,
        { id: In(donationIds) },
        { paymentId: payment.id },
      );

      const success = await this.outboxService.markAsProcessed(
        event.id,
        payment.transactionId,
        qr.manager,
      );

      if (!success) {
        this.logger.warn(`[${correlationId}] Outbox ${event.id} already processed or status changed.`);
      }

      await qr.commitTransaction();
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
