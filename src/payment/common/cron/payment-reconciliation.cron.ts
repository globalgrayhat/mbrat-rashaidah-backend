/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Payment Reconciliation Service
 *
 * This service handles automatic reconciliation of pending payments.
 * It runs as a cron job every 3 minutes to:
 * 1. Find payments that are pending for more than 15 minutes
 * 2. Check their status with the payment provider
 * 3. Update them to 'failed' if still pending after 15 minutes
 *
 * This service is completely independent from PaymentService and can be
 * used in any project that needs payment reconciliation.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Payment } from '../entities/payment.entity';
import { PaymentService } from '../../payment.service';
import { PaymentProviderType } from '../interfaces/payment-provider.interface';

@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  private readonly PENDING_TIMEOUT_MINUTES = 15;
  private readonly PENDING_TIMEOUT_MS =
    this.PENDING_TIMEOUT_MINUTES * 60 * 1000;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Cron job that runs every 3 minutes
   * Checks pending payments and reconciles their status
   */
  @Cron('*/3 * * * *') // Every 3 minutes
  async handlePaymentReconciliation() {
    this.logger.log('Starting payment reconciliation cron job...');

    try {
      const result = await this.reconcilePendingPayments();
      this.logger.log(
        `Payment reconciliation completed. Processed: ${result.processed}, Updated: ${result.updated}, Failed: ${result.failed}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Payment reconciliation cron job failed:', error);
      throw error;
    }
  }

  /**
   * Reconcile pending payments that exceed the timeout threshold
   * This method can be called manually or by the cron job
   *
   * @returns Reconciliation result with statistics
   */
  async reconcilePendingPayments(): Promise<{
    processed: number;
    updated: number;
    failed: number;
    errors: number;
  }> {
    const thresholdDate = new Date(Date.now() - this.PENDING_TIMEOUT_MS);

    const pendingPayments = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('LOWER(payment.status) = :status', { status: 'pending' })
      .andWhere('payment.createdAt < :threshold', { threshold: thresholdDate })
      .orderBy('payment.createdAt', 'ASC')
      .limit(100)
      .getMany();

    if (pendingPayments.length === 0) {
      this.logger.debug('No pending payments found for reconciliation');
      return { processed: 0, updated: 0, failed: 0, errors: 0 };
    }

    this.logger.log(
      `Found ${pendingPayments.length} pending payments to reconcile`,
    );

    let updated = 0;
    let failed = 0;
    let errors = 0;

    // Process each payment
    for (const payment of pendingPayments) {
      try {
        const result = await this.reconcileSinglePayment(payment);
        if (result.updated) {
          updated++;
        }
        if (result.markedAsFailed) {
          failed++;
        }
      } catch (error) {
        errors++;
        this.logger.error(
          `Failed to reconcile payment ${payment.id}:`,
          error instanceof Error ? error.message : String(error),
        );
        // Continue with next payment even if one fails
      }
    }

    return {
      processed: pendingPayments.length,
      updated,
      failed,
      errors,
    };
  }

  /**
   * Reconcile a single payment
   * Checks payment status with provider and updates if needed
   *
   * @param payment Payment entity to reconcile
   * @returns Reconciliation result
   */
  private async reconcileSinglePayment(payment: Payment): Promise<{
    updated: boolean;
    markedAsFailed: boolean;
    newStatus?: string;
  }> {
    try {
      // Determine provider from rawResponse or use default
      const provider = this.detectProviderFromPayment(payment);

      const providerTimeoutInfo = this.hasExceededTimeout(payment);

      if (!provider) {
        this.logger.warn(
          `Cannot determine provider for payment ${payment.id}, marking as failed due to timeout`,
        );
        // If we can't determine provider and payment exceeds timeout, mark as failed
        if (providerTimeoutInfo.exceeded) {
          await this.paymentRepository.update(payment.id, {
            status: 'failed',
            rawResponse: {
              ...(this.parseRawResponse(payment.rawResponse) || {}),
              reconciliation: {
                timestamp: new Date().toISOString(),
                reason: 'Payment timeout: cannot determine provider',
                minutesSinceCreation: providerTimeoutInfo.minutesSinceCreation,
              },
            },
          });
          return { updated: true, markedAsFailed: true, newStatus: 'failed' };
        }
        return { updated: false, markedAsFailed: false };
      }

      // Check payment status with provider
      const statusResult = await this.paymentService.getPaymentStatus(
        payment.transactionId,
        provider,
      );

      // Calculate time since creation
      const statusTimeoutInfo = this.hasExceededTimeout(payment);
      const { exceeded, minutesSinceCreation } = statusTimeoutInfo;

      // If payment is still pending and exceeds timeout, mark as failed
      if (statusResult.outcome === 'pending' && exceeded) {
        const currentRaw = this.parseRawResponse(payment.rawResponse) || {};
        await this.paymentRepository.update(payment.id, {
          status: 'failed',
          rawResponse: {
            ...currentRaw,
            reconciliation: {
              timestamp: new Date().toISOString(),
              reason: 'Payment timeout: exceeded 15 minutes',
              minutesSinceCreation,
              lastCheckedStatus: statusResult.outcome,
            },
          },
        });

        this.logger.warn(
          `Payment ${payment.id} marked as failed due to timeout (${minutesSinceCreation} minutes)`,
        );

        return { updated: true, markedAsFailed: true, newStatus: 'failed' };
      }

      // If payment status changed (paid or failed), update it
      if (statusResult.outcome !== 'pending') {
        const newStatus =
          statusResult.outcome === 'paid' ? 'paid' : statusResult.outcome;

        const currentRaw = this.parseRawResponse(payment.rawResponse) || {};
        await this.paymentRepository.update(payment.id, {
          status: newStatus,
          rawResponse: {
            ...currentRaw,
            reconciliation: {
              timestamp: new Date().toISOString(),
              previousStatus: payment.status,
              newStatus: statusResult.outcome,
              minutesSinceCreation,
            },
          },
        });

        this.logger.log(
          `Payment ${payment.id} status updated from 'pending' to '${newStatus}'`,
        );

        return { updated: true, markedAsFailed: false, newStatus };
      }

      // Payment is still pending but hasn't exceeded timeout yet
      this.logger.debug(
        `Payment ${payment.id} still pending (${minutesSinceCreation} minutes), will check again`,
      );

      return { updated: false, markedAsFailed: false };
    } catch (error) {
      // If provider check fails and payment exceeds timeout, mark as failed
      const errorTimeoutInfo = this.hasExceededTimeout(payment);

      if (errorTimeoutInfo.exceeded) {
        const currentRaw = this.parseRawResponse(payment.rawResponse) || {};
        await this.paymentRepository.update(payment.id, {
          status: 'failed',
          rawResponse: {
            ...currentRaw,
            reconciliation: {
              timestamp: new Date().toISOString(),
              reason: 'Payment timeout: provider check failed',
              minutesSinceCreation: errorTimeoutInfo.minutesSinceCreation,
              error: error instanceof Error ? error.message : String(error),
            },
          },
        });

        this.logger.warn(
          `Payment ${payment.id} marked as failed due to provider check error and timeout`,
        );

        return { updated: true, markedAsFailed: true, newStatus: 'failed' };
      }

      // Re-throw error if payment hasn't exceeded timeout
      throw error;
    }
  }

  private hasExceededTimeout(payment: Payment): {
    exceeded: boolean;
    minutesSinceCreation: number;
  } {
    const minutesSinceCreation = Math.floor(
      (Date.now() - payment.createdAt.getTime()) / 60000,
    );
    return {
      exceeded: minutesSinceCreation >= this.PENDING_TIMEOUT_MINUTES,
      minutesSinceCreation,
    };
  }

  /**
   * Parse rawResponse if it's a string
   */
  private parseRawResponse(rawResponse: any): any {
    if (!rawResponse) return null;
    if (typeof rawResponse === 'string') {
      try {
        return JSON.parse(rawResponse);
      } catch {
        return null;
      }
    }
    return rawResponse;
  }

  /**
   * Detect payment provider from payment entity
   * Tries to determine provider from rawResponse or uses default
   *
   * @param payment Payment entity
   * @returns Detected provider type or null
   */
  private detectProviderFromPayment(
    payment: Payment,
  ): PaymentProviderType | null {
    // Parse rawResponse if it's a string
    const raw = this.parseRawResponse(payment.rawResponse);

    // Try to get provider from rawResponse metadata
    if (raw) {
      // Check for provider in metadata
      if (raw.provider) {
        return raw.provider as PaymentProviderType;
      }

      // Check for MyFatoorah indicators
      if (raw.InvoiceId || raw.InvoiceURL || raw.PaymentMethods) {
        return 'myfatoorah';
      }

      // Check for PayMob indicators
      if (raw.intentionId || raw.payment_keys || raw.order_id) {
        return 'paymob';
      }

      // Check for Stripe indicators
      if (raw.id?.startsWith('pi_') || raw.client_secret) {
        return 'stripe';
      }
    }

    // Try to detect from transactionId format
    if (payment.transactionId) {
      // MyFatoorah InvoiceId is usually numeric
      if (/^\d+$/.test(payment.transactionId)) {
        return 'myfatoorah';
      }

      // Stripe Payment Intent starts with 'pi_'
      if (payment.transactionId.startsWith('pi_')) {
        return 'stripe';
      }

      // PayMob IDs are usually numeric
      if (/^\d+$/.test(payment.transactionId)) {
        // Could be PayMob or MyFatoorah, try PayMob first
        return 'paymob';
      }
    }

    // Default to MyFatoorah if no indicators found
    // (assuming it's the default provider)
    const defaultProvider = this.paymentService.getActiveProviderName();
    if (defaultProvider && defaultProvider !== 'none') {
      return defaultProvider;
    }

    // Try registered providers in order
    const registeredProviders = this.paymentService.getRegisteredProviders();
    if (registeredProviders.length > 0) {
      return registeredProviders[0];
    }

    return null;
  }

  /**
   * Manually trigger reconciliation for a specific payment
   * Useful for testing or manual reconciliation
   *
   * @param paymentId Payment ID to reconcile
   * @returns Reconciliation result
   */
  async reconcilePaymentById(paymentId: string): Promise<{
    success: boolean;
    updated: boolean;
    newStatus?: string;
    message: string;
  }> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return {
        success: false,
        updated: false,
        message: `Payment ${paymentId} not found`,
      };
    }

    if (payment.status !== 'pending') {
      return {
        success: true,
        updated: false,
        message: `Payment ${paymentId} is not pending (current status: ${payment.status})`,
      };
    }

    try {
      const result = await this.reconcileSinglePayment(payment);
      return {
        success: true,
        updated: result.updated,
        newStatus: result.newStatus,
        message: result.updated
          ? `Payment ${paymentId} updated to ${result.newStatus}`
          : `Payment ${paymentId} still pending`,
      };
    } catch (error) {
      return {
        success: false,
        updated: false,
        message: `Failed to reconcile payment ${paymentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Get statistics about pending payments
   * Useful for monitoring and reporting
   *
   * @returns Statistics about pending payments
   */
  async getPendingPaymentsStats(): Promise<{
    totalPending: number;
    pendingOver15Min: number;
    oldestPendingMinutes: number;
    oldestPendingDate?: Date;
  }> {
    const thresholdDate = new Date(Date.now() - this.PENDING_TIMEOUT_MS);

    // Count all pending payments
    const totalPending = await this.paymentRepository.count({
      where: { status: 'pending' },
    });

    // Count pending payments over 15 minutes
    const pendingOver15Min = await this.paymentRepository.count({
      where: {
        status: 'pending',
        createdAt: LessThan(thresholdDate),
      },
    });

    // Find oldest pending payment
    const oldestPending = await this.paymentRepository.findOne({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
    });

    const oldestPendingMinutes = oldestPending
      ? Math.floor((Date.now() - oldestPending.createdAt.getTime()) / 60000)
      : 0;

    return {
      totalPending,
      pendingOver15Min,
      oldestPendingMinutes,
      oldestPendingDate: oldestPending?.createdAt,
    };
  }

  public getPendingTimeoutMinutes(): number {
    return this.PENDING_TIMEOUT_MINUTES;
  }
}
