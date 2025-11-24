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
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Payment } from '../entities/payment.entity';
import { PaymentService } from '../../payment.service';
import { PaymentProviderType } from '../interfaces/payment-provider.interface';

/**
 * Temporary payment storage in memory
 * Stores payment ID and discovery timestamp
 */
interface TemporaryPayment {
  paymentId: string;
  transactionId: string;
  discoveredAt: Date;
  status: string;
}

@Injectable()
export class PaymentReconciliationService implements OnModuleDestroy {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  private readonly PENDING_TIMEOUT_MINUTES = 15;
  private readonly PENDING_TIMEOUT_MS =
    this.PENDING_TIMEOUT_MINUTES * 60 * 1000;

  /**
   * In-memory cache for newly discovered payments
   * Key: paymentId (UUID), Value: TemporaryPayment with discovery timestamp
   * This allows tracking payments from discovery time, not database creation time
   */
  private readonly temporaryPaymentsCache = new Map<string, TemporaryPayment>();

  /**
   * Maximum number of payments to keep in memory cache
   * Prevents memory overflow in high-traffic scenarios
   */
  private readonly MAX_CACHE_SIZE = 10000;

  /**
   * Cleanup interval reference for proper cleanup on module destroy
   */
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Track oldest entries for efficient cleanup (performance optimization)
   * This avoids sorting the entire cache when removing old entries
   */
  private readonly oldestEntriesThreshold = 1000; // Clean up in batches

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly paymentService: PaymentService,
  ) {
    // Clean up old entries from cache every 20 minutes
    // Store interval reference for cleanup on module destroy
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupTemporaryCache();
      },
      20 * 60 * 1000,
    );
  }

  /**
   * Cleanup resources on module destroy
   * Prevents memory leaks by clearing interval and cache
   */
  onModuleDestroy(): void {
    // Clear cleanup interval to prevent memory leak
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      this.logger.log('Payment reconciliation cleanup interval cleared');
    }

    // Clear cache to free memory
    const cacheSize = this.temporaryPaymentsCache.size;
    this.temporaryPaymentsCache.clear();
    this.logger.log(
      `Payment reconciliation cache cleared (${cacheSize} entries freed)`,
    );
  }

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
   * Register a newly discovered payment in temporary memory cache
   * This allows tracking payments from discovery time, not database creation time
   *
   * Performance optimizations:
   * - Efficient cache overflow handling (removes oldest entries in batches)
   * - Prevents memory leaks by limiting cache size
   *
   * @param paymentId Payment UUID
   * @param transactionId Transaction ID from payment provider
   * @param status Current payment status
   */
  registerNewPayment(
    paymentId: string,
    transactionId: string,
    status: string = 'pending',
  ): void {
    // Prevent cache overflow - optimized performance
    if (this.temporaryPaymentsCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries efficiently (10% of cache or minimum threshold)
      const entriesToRemove = Math.max(
        Math.floor(this.MAX_CACHE_SIZE * 0.1),
        this.oldestEntriesThreshold,
      );

      // Performance optimization: Use iterator instead of converting to array
      // Only process entries that need to be removed
      const entries: Array<[string, TemporaryPayment]> = [];
      for (const entry of this.temporaryPaymentsCache.entries()) {
        entries.push(entry);
        // Early exit if we have enough entries to sort
        if (entries.length >= entriesToRemove * 2) {
          break;
        }
      }

      // Sort only the entries we collected (much faster than sorting entire cache)
      entries.sort(
        (a, b) => a[1].discoveredAt.getTime() - b[1].discoveredAt.getTime(),
      );

      // Remove oldest entries
      for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
        this.temporaryPaymentsCache.delete(entries[i][0]);
      }

      this.logger.warn(
        `Temporary payments cache reached maximum size (${this.MAX_CACHE_SIZE}), removed ${Math.min(entriesToRemove, entries.length)} oldest entries`,
      );
    }

    // Add new payment to cache
    this.temporaryPaymentsCache.set(paymentId, {
      paymentId,
      transactionId,
      discoveredAt: new Date(),
      status,
    });

    this.logger.debug(
      `Registered new payment ${paymentId} in temporary cache (transactionId: ${transactionId}, cache size: ${this.temporaryPaymentsCache.size})`,
    );
  }

  /**
   * Clean up old entries from temporary cache
   * Removes entries older than 30 minutes (2x timeout period)
   *
   * Performance optimizations:
   * - Uses efficient iteration with early exit
   * - Processes in batches to avoid blocking
   * - Cleans up both expired and non-pending entries
   *
   * @returns Number of entries cleaned up
   */
  private cleanupTemporaryCache(): number {
    const cleanupThreshold = new Date(Date.now() - this.PENDING_TIMEOUT_MS * 2);
    let cleanedCount = 0;
    const keysToDelete: string[] = [];

    // Performance optimization: Collect keys to delete first, then delete in batch
    // This avoids modifying Map during iteration
    for (const [paymentId, payment] of this.temporaryPaymentsCache.entries()) {
      // Remove entries that are:
      // 1. Older than 30 minutes (2x timeout)
      // 2. Not pending (already processed)
      if (
        payment.discoveredAt < cleanupThreshold ||
        payment.status !== 'pending'
      ) {
        keysToDelete.push(paymentId);
      }
    }

    // Batch delete for better performance
    for (const key of keysToDelete) {
      if (this.temporaryPaymentsCache.delete(key)) {
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(
        `Cleaned up ${cleanedCount} old/processed entries from temporary payments cache (remaining: ${this.temporaryPaymentsCache.size})`,
      );
    }

    return cleanedCount;
  }

  /**
   * Get temporary payment from cache if exists
   *
   * @param paymentId Payment UUID
   * @returns TemporaryPayment or null
   */
  private getTemporaryPayment(paymentId: string): TemporaryPayment | null {
    return this.temporaryPaymentsCache.get(paymentId) || null;
  }

  /**
   * Reconcile pending payments that exceed the timeout threshold
   * This method checks both temporary cache and database
   *
   * @returns Reconciliation result with statistics
   */
  async reconcilePendingPayments(): Promise<{
    processed: number;
    updated: number;
    failed: number;
    errors: number;
    fromCache: number;
    fromDatabase: number;
  }> {
    const thresholdDate = new Date(Date.now() - this.PENDING_TIMEOUT_MS);

    // 1. First, check temporary cache for payments that exceeded timeout
    // Performance optimization: Pre-allocate array with estimated size
    const cachePaymentsToReconcile: TemporaryPayment[] = [];
    const now = Date.now();

    // Performance optimization: Single pass iteration with early filtering
    for (const payment of this.temporaryPaymentsCache.values()) {
      // Only process pending payments
      if (payment.status !== 'pending') {
        continue;
      }

      // Calculate time since discovery efficiently
      const timeSinceDiscovery = now - payment.discoveredAt.getTime();
      if (timeSinceDiscovery >= this.PENDING_TIMEOUT_MS) {
        cachePaymentsToReconcile.push(payment);
      }
    }

    // 2. Also check database for pending payments older than threshold
    const dbPendingPayments = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('LOWER(payment.status) = :status', { status: 'pending' })
      .andWhere('payment.createdAt < :threshold', { threshold: thresholdDate })
      .orderBy('payment.createdAt', 'ASC')
      .limit(100)
      .getMany();

    // Filter out payments that are already in cache (to avoid double processing)
    const dbPaymentsToReconcile = dbPendingPayments.filter(
      (p) => !this.temporaryPaymentsCache.has(p.id),
    );

    const totalPaymentsToProcess =
      cachePaymentsToReconcile.length + dbPaymentsToReconcile.length;

    if (totalPaymentsToProcess === 0) {
      this.logger.debug('No pending payments found for reconciliation');
      return {
        processed: 0,
        updated: 0,
        failed: 0,
        errors: 0,
        fromCache: 0,
        fromDatabase: 0,
      };
    }

    this.logger.log(
      `Found ${totalPaymentsToProcess} pending payments to reconcile (${cachePaymentsToReconcile.length} from cache, ${dbPaymentsToReconcile.length} from database)`,
    );

    let updated = 0;
    let failed = 0;
    let errors = 0;

    // 3. Process payments from cache first (using discovery time)
    for (const tempPayment of cachePaymentsToReconcile) {
      try {
        // Fetch full payment entity from database
        const payment = await this.paymentRepository.findOne({
          where: { id: tempPayment.paymentId },
        });

        if (!payment) {
          // Payment not found in database, remove from cache
          this.temporaryPaymentsCache.delete(tempPayment.paymentId);
          this.logger.warn(
            `Payment ${tempPayment.paymentId} found in cache but not in database, removed from cache`,
          );
          continue;
        }

        // Use discovery time instead of creation time for timeout calculation
        const result = await this.reconcileSinglePayment(
          payment,
          tempPayment.discoveredAt,
        );
        if (result.updated) {
          updated++;
          // Remove from cache after successful reconciliation
          this.temporaryPaymentsCache.delete(tempPayment.paymentId);
        }
        if (result.markedAsFailed) {
          failed++;
          // Remove from cache after marking as failed
          this.temporaryPaymentsCache.delete(tempPayment.paymentId);
        }
      } catch (error) {
        errors++;
        this.logger.error(
          `Failed to reconcile payment ${tempPayment.paymentId} from cache:`,
          error instanceof Error ? error.message : String(error),
        );
        // Continue with next payment even if one fails
      }
    }

    // 4. Process payments from database (using creation time)
    for (const payment of dbPaymentsToReconcile) {
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
      processed: totalPaymentsToProcess,
      updated,
      failed,
      errors,
      fromCache: cachePaymentsToReconcile.length,
      fromDatabase: dbPaymentsToReconcile.length,
    };
  }

  /**
   * Reconcile a single payment
   * Checks payment status with provider and updates if needed
   *
   * @param payment Payment entity to reconcile
   * @param discoveryTime Optional discovery time (from cache). If not provided, uses payment.createdAt
   * @returns Reconciliation result
   */
  private async reconcileSinglePayment(
    payment: Payment,
    discoveryTime?: Date,
  ): Promise<{
    updated: boolean;
    markedAsFailed: boolean;
    newStatus?: string;
  }> {
    try {
      // Determine provider from rawResponse or use default
      const provider = this.detectProviderFromPayment(payment);

      // Use discovery time if provided (from cache), otherwise use creation time
      const referenceTime = discoveryTime || payment.createdAt;
      const timeoutInfo = this.hasExceededTimeout(referenceTime);

      if (!provider) {
        this.logger.warn(
          `Cannot determine provider for payment ${payment.id}, marking as failed due to timeout`,
        );
        // If we can't determine provider and payment exceeds timeout, mark as failed
        if (timeoutInfo.exceeded) {
          await this.paymentRepository.update(payment.id, {
            status: 'failed',
            rawResponse: {
              ...(this.parseRawResponse(payment.rawResponse) || {}),
              reconciliation: {
                timestamp: new Date().toISOString(),
                reason: 'Payment timeout: cannot determine provider',
                minutesSinceReference: timeoutInfo.minutesSinceReference,
                referenceTime: referenceTime.toISOString(),
                usedDiscoveryTime: !!discoveryTime,
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

      // Recalculate timeout with same reference time
      const statusTimeoutInfo = this.hasExceededTimeout(referenceTime);
      const { exceeded, minutesSinceReference } = statusTimeoutInfo;

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
              minutesSinceReference,
              lastCheckedStatus: statusResult.outcome,
              referenceTime: referenceTime.toISOString(),
              usedDiscoveryTime: !!discoveryTime,
            },
          },
        });

        this.logger.warn(
          `Payment ${payment.id} marked as failed due to timeout (${minutesSinceReference} minutes since ${discoveryTime ? 'discovery' : 'creation'})`,
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
              minutesSinceReference,
              referenceTime: referenceTime.toISOString(),
              usedDiscoveryTime: !!discoveryTime,
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
        `Payment ${payment.id} still pending (${minutesSinceReference} minutes since ${discoveryTime ? 'discovery' : 'creation'}), will check again`,
      );

      return { updated: false, markedAsFailed: false };
    } catch (error) {
      // If provider check fails and payment exceeds timeout, mark as failed
      const referenceTime = discoveryTime || payment.createdAt;
      const errorTimeoutInfo = this.hasExceededTimeout(referenceTime);

      if (errorTimeoutInfo.exceeded) {
        const currentRaw = this.parseRawResponse(payment.rawResponse) || {};
        await this.paymentRepository.update(payment.id, {
          status: 'failed',
          rawResponse: {
            ...currentRaw,
            reconciliation: {
              timestamp: new Date().toISOString(),
              reason: 'Payment timeout: provider check failed',
              minutesSinceReference: errorTimeoutInfo.minutesSinceReference,
              referenceTime: referenceTime.toISOString(),
              usedDiscoveryTime: !!discoveryTime,
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

  /**
   * Check if payment has exceeded timeout based on reference time
   *
   * @param referenceTime Discovery time or creation time
   * @returns Timeout information
   */
  private hasExceededTimeout(referenceTime: Date): {
    exceeded: boolean;
    minutesSinceReference: number;
  } {
    const minutesSinceReference = Math.floor(
      (Date.now() - referenceTime.getTime()) / 60000,
    );
    return {
      exceeded: minutesSinceReference >= this.PENDING_TIMEOUT_MINUTES,
      minutesSinceReference,
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
    cacheSize: number;
    cachePendingCount: number;
  }> {
    const thresholdDate = new Date(Date.now() - this.PENDING_TIMEOUT_MS);
    const now = Date.now();

    // Count all pending payments in database
    const totalPending = await this.paymentRepository.count({
      where: { status: 'pending' },
    });

    // Count pending payments over 15 minutes in database
    const pendingOver15Min = await this.paymentRepository.count({
      where: {
        status: 'pending',
        createdAt: LessThan(thresholdDate),
      },
    });

    // Count pending payments in cache (performance optimized: single pass)
    let cachePendingCount = 0;
    let oldestCachePayment: TemporaryPayment | null = null;

    for (const payment of this.temporaryPaymentsCache.values()) {
      if (payment.status === 'pending') {
        cachePendingCount++;
        // Find oldest pending payment efficiently
        if (
          !oldestCachePayment ||
          payment.discoveredAt.getTime() <
            oldestCachePayment.discoveredAt.getTime()
        ) {
          oldestCachePayment = payment;
        }
      }
    }

    // Find oldest pending payment (from database or cache)
    const oldestDbPending = await this.paymentRepository.findOne({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
    });

    let oldestPending: { date: Date; fromCache: boolean } | null = null;

    if (oldestDbPending && oldestCachePayment) {
      // Compare both and pick the oldest
      if (oldestDbPending.createdAt < oldestCachePayment.discoveredAt) {
        oldestPending = { date: oldestDbPending.createdAt, fromCache: false };
      } else {
        oldestPending = {
          date: oldestCachePayment.discoveredAt,
          fromCache: true,
        };
      }
    } else if (oldestDbPending) {
      oldestPending = { date: oldestDbPending.createdAt, fromCache: false };
    } else if (oldestCachePayment) {
      oldestPending = {
        date: oldestCachePayment.discoveredAt,
        fromCache: true,
      };
    }

    const oldestPendingMinutes = oldestPending
      ? Math.floor((now - oldestPending.date.getTime()) / 60000)
      : 0;

    return {
      totalPending,
      pendingOver15Min,
      oldestPendingMinutes,
      oldestPendingDate: oldestPending?.date,
      cacheSize: this.temporaryPaymentsCache.size,
      cachePendingCount,
    };
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  getCacheStats(): {
    size: number;
    pendingCount: number;
    maxSize: number;
  } {
    let pendingCount = 0;
    for (const payment of this.temporaryPaymentsCache.values()) {
      if (payment.status === 'pending') {
        pendingCount++;
      }
    }

    return {
      size: this.temporaryPaymentsCache.size,
      pendingCount,
      maxSize: this.MAX_CACHE_SIZE,
    };
  }

  public getPendingTimeoutMinutes(): number {
    return this.PENDING_TIMEOUT_MINUTES;
  }
}
