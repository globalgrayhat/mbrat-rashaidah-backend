import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxService } from './outbox.service';
import { OutboxStatus, OutboxEvent } from '../entities/outbox-event.entity';
import { PaymentService } from '../../../payment/payment.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Donation } from '../../../donations/entities/donation.entity';
import { Payment } from '../../../payment/entities/payment.entity';
import { createPaymentForEntity } from '../../../payment/common/utils/payment.utils';

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
    const { donationIds, paymentMethod } = event.payload;

    // Check if event is already processed (safety)
    if (event.status === OutboxStatus.PROCESSED) {
      return;
    }

    this.logger.log(
      `[${correlationId}] Attempting recovery for donations: ${donationIds.join(', ')}`,
    );

    // 1. Check if a payment already exists for this transaction reference
    // This is more direct than checking donations first
    const referenceId = donationIds[0];
    const existingPayment = await this.paymentRepository.findOne({
      where: { transactionId: referenceId },
    });

    if (existingPayment) {
      this.logger.log(
        `[${correlationId}] Payment ${existingPayment.transactionId} already exists. Linking donations and resolving outbox.`,
      );
      await this.linkDonationsAndResolve(
        event,
        existingPayment,
        donationIds,
        correlationId,
      );
      return;
    }

    // 2. Check if any donation in the set is already linked
    const existingDonations = await this.donationRepository.find({
      where: { id: In(donationIds) },
      select: ['id', 'paymentId'],
    });

    const linkedDonation = existingDonations.find((d) => d.paymentId);
    if (linkedDonation) {
      this.logger.log(
        `[${correlationId}] Donation ${linkedDonation.id} already linked. Marking outbox as processed.`,
      );
      await this.outboxService.markAsProcessed(event.id, undefined);
      return;
    }

    // 3. Check with the Payment Gateway
    const providerName = this.paymentService.getActiveProviderName();
    this.logger.debug(
      `[${correlationId}] Verifying status with ${providerName} for reference ${referenceId}`,
    );

    try {
      const statusResult = await this.paymentService.getPaymentStatus(
        referenceId,
        providerName,
      );

      if (
        statusResult.outcome === 'paid' ||
        statusResult.outcome === 'pending'
      ) {
        this.logger.log(
          `[${correlationId}] Payment found at gateway (${statusResult.outcome}). Creating local record.`,
        );

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();

        try {
          const { payment } = await createPaymentForEntity(
            this.paymentService,
            qr.manager.getRepository(Payment),
            {
              entityId: referenceId,
              amount: statusResult.amount || 0,
              currency: statusResult.currency || 'KWD',
              description: `Recovered payment for ${donationIds.length} items`,
              customerName: 'Recovered Customer',
              paymentMethodId: paymentMethod,
              metadata: {
                correlationId,
                recoveredFrom: event.id,
                entityType: 'donation',
              },
            },
          );

          await qr.manager.update(
            Donation,
            { id: In(donationIds) },
            { paymentId: payment.id },
          );

          await this.outboxService.markAsProcessed(
            event.id,
            payment.transactionId,
            qr.manager,
          );
          await qr.commitTransaction();
          this.logger.log(
            `[${correlationId}] Recovery SUCCESSFUL for Outbox ${event.id}`,
          );
        } catch (innerError) {
          await qr.rollbackTransaction();
          throw innerError;
        } finally {
          await qr.release();
        }
      } else if (statusResult.outcome === 'failed') {
        await this.outboxService.markAsFailed(
          event.id,
          'Payment failed at gateway',
        );
      }
    } catch (gatewayError) {
      throw gatewayError;
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
      await qr.manager.update(
        Donation,
        { id: In(donationIds) },
        { paymentId: payment.id },
      );
      await this.outboxService.markAsProcessed(
        event.id,
        payment.transactionId,
        qr.manager,
      );
      await qr.commitTransaction();
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
