/**
 * Payment Reconciliation Controller
 *
 * Provides endpoints for manual payment reconciliation and monitoring.
 * The automatic reconciliation runs via cron job every 3 minutes.
 */
import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
import { PaymentReconciliationService } from './payment-reconciliation.cron';

@Controller('payment-reconciliation')
export class PaymentReconciliationController {
  private readonly logger = new Logger(PaymentReconciliationController.name);

  constructor(
    private readonly reconciliationService: PaymentReconciliationService,
  ) {}

  /**
   * Manually trigger reconciliation for all pending payments
   * POST /payment-reconciliation/reconcile
   */
  @Post('reconcile')
  async reconcileAll() {
    this.logger.log('Manual reconciliation triggered');
    const result = await this.reconciliationService.reconcilePendingPayments();
    return {
      success: true,
      message: 'Reconciliation completed',
      timeoutMinutes: this.reconciliationService.getPendingTimeoutMinutes(),
      ...result,
    };
  }

  /**
   * Reconcile a specific payment by ID
   * POST /payment-reconciliation/reconcile/:paymentId
   */
  @Post('reconcile/:paymentId')
  async reconcilePayment(@Param('paymentId') paymentId: string) {
    this.logger.log(`Manual reconciliation triggered for payment ${paymentId}`);
    const result =
      await this.reconciliationService.reconcilePaymentById(paymentId);
    return {
      ...result,
      timeoutMinutes: this.reconciliationService.getPendingTimeoutMinutes(),
    };
  }

  /**
   * Get statistics about pending payments
   * GET /payment-reconciliation/stats
   */
  @Get('stats')
  async getStats() {
    const stats = await this.reconciliationService.getPendingPaymentsStats();
    const cacheStats = this.reconciliationService.getCacheStats();
    return {
      success: true,
      timeoutMinutes: this.reconciliationService.getPendingTimeoutMinutes(),
      ...stats,
      cache: cacheStats,
    };
  }

  /**
   * Register a newly discovered payment in temporary cache
   * POST /payment-reconciliation/register
   * Body: { paymentId: string, transactionId: string, status?: string }
   */
  @Post('register')
  registerPayment(
    @Body()
    body: {
      paymentId: string;
      transactionId: string;
      status?: string;
    },
  ) {
    if (!body.paymentId || !body.transactionId) {
      return {
        success: false,
        message: 'paymentId and transactionId are required',
      };
    }

    this.reconciliationService.registerNewPayment(
      body.paymentId,
      body.transactionId,
      body.status || 'pending',
    );

    return {
      success: true,
      message: `Payment ${body.paymentId} registered in temporary cache`,
      paymentId: body.paymentId,
      transactionId: body.transactionId,
    };
  }
}
