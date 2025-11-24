/**
 * Payment Reconciliation Controller
 *
 * Provides endpoints for manual payment reconciliation and monitoring.
 * The automatic reconciliation runs via cron job every 3 minutes.
 */
import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
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
    return {
      success: true,
      timeoutMinutes: this.reconciliationService.getPendingTimeoutMinutes(),
      ...stats,
    };
  }
}
