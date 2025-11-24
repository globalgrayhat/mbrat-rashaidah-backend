import { Injectable, Logger } from '@nestjs/common';

export interface TransactionLogEntry {
  transactionId: string;
  type:
    | 'payment_created'
    | 'payment_verified'
    | 'payment_webhook'
    | 'payment_reconciled';
  status: 'success' | 'failed' | 'pending';
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  timestamp: Date;
}

/**
 * Centralized transaction logging service
 * Provides structured logging for all payment-related transactions
 */
@Injectable()
export class TransactionLoggerService {
  private readonly logger = new Logger(TransactionLoggerService.name);

  /**
   * Log a payment transaction event
   */
  logTransaction(entry: Omit<TransactionLogEntry, 'timestamp'>): void {
    const logEntry: TransactionLogEntry = {
      ...entry,
      timestamp: new Date(),
    };

    const logMessage = this.formatLogMessage(logEntry);
    const logContext = this.extractLogContext(logEntry);

    if (entry.status === 'failed') {
      this.logger.error(logMessage, logContext);
    } else if (entry.status === 'pending') {
      this.logger.warn(logMessage, logContext);
    } else {
      this.logger.log(logMessage, logContext);
    }

    // TODO: Store in database for audit trail
    // await this.transactionLogRepository.save(logEntry);
  }

  /**
   * Format log message for readability
   */
  private formatLogMessage(entry: TransactionLogEntry): string {
    const parts = [
      `[${entry.type.toUpperCase()}]`,
      `Transaction: ${entry.transactionId}`,
      `Status: ${entry.status.toUpperCase()}`,
    ];

    if (entry.amount && entry.currency) {
      parts.push(`Amount: ${entry.amount} ${entry.currency}`);
    }

    if (entry.paymentMethod) {
      parts.push(`Method: ${entry.paymentMethod}`);
    }

    if (entry.error) {
      parts.push(`Error: ${entry.error}`);
    }

    return parts.join(' | ');
  }

  /**
   * Extract structured context for logging
   */
  private extractLogContext(
    entry: TransactionLogEntry,
  ): Record<string, unknown> {
    return {
      transactionId: entry.transactionId,
      type: entry.type,
      status: entry.status,
      amount: entry.amount,
      currency: entry.currency,
      paymentMethod: entry.paymentMethod,
      metadata: entry.metadata,
      error: entry.error,
      timestamp: entry.timestamp.toISOString(),
    };
  }

  /**
   * Log payment creation
   */
  logPaymentCreated(
    transactionId: string,
    amount: number,
    currency: string,
    paymentMethod: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.logTransaction({
      transactionId,
      type: 'payment_created',
      status: 'success',
      amount,
      currency,
      paymentMethod,
      metadata,
    });
  }

  /**
   * Log payment verification
   */
  logPaymentVerified(
    transactionId: string,
    status: 'success' | 'failed',
    outcome: 'paid' | 'failed' | 'pending',
    metadata?: Record<string, unknown>,
    error?: string,
  ): void {
    this.logTransaction({
      transactionId,
      type: 'payment_verified',
      status,
      metadata: {
        ...metadata,
        outcome,
      },
      error,
    });
  }

  /**
   * Log webhook received
   */
  logWebhookReceived(
    transactionId: string,
    status: 'success' | 'failed',
    metadata?: Record<string, unknown>,
    error?: string,
  ): void {
    this.logTransaction({
      transactionId,
      type: 'payment_webhook',
      status,
      metadata,
      error,
    });
  }

  /**
   * Log payment reconciliation
   */
  logPaymentReconciled(
    transactionId: string,
    status: 'success' | 'failed',
    outcome: 'paid' | 'failed' | 'pending',
    metadata?: Record<string, unknown>,
    error?: string,
  ): void {
    this.logTransaction({
      transactionId,
      type: 'payment_reconciled',
      status,
      metadata: {
        ...metadata,
        outcome,
      },
      error,
    });
  }
}
