/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';

export interface PaymentNotificationPayload {
  paymentId: string;
  invoiceId: string;
  status: 'paid' | 'failed' | 'pending';
  amount: number;
  currency: string;
  donorEmail?: string;
  donorName?: string;
  donorPhone?: string;
  donationIds: string[];
}

/**
 * Notification service for payment status changes
 * Handles notifications to donors and administrators
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly config: AppConfigService) {}

  /**
   * Send notification when payment status changes
   */
  async notifyPaymentStatusChange(
    payload: PaymentNotificationPayload,
  ): Promise<void> {
    try {
      const { status, donorEmail, donorName } = payload;

      // Log the notification attempt
      this.logger.log(
        `Sending payment status notification: ${status} for payment ${payload.paymentId}`,
      );

      // Send notifications in parallel
      const notifications: Promise<void>[] = [];

      // Notify donor if email is available
      if (donorEmail && status !== 'pending') {
        notifications.push(this.notifyDonor(payload));
      }

      // Always notify admin for status changes
      notifications.push(this.notifyAdmin(payload));

      await Promise.allSettled(notifications);

      this.logger.log(
        `Payment notifications sent successfully for payment ${payload.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send payment notifications: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - notifications are non-critical
    }
  }

  /**
   * Notify donor about payment status
   */
  private async notifyDonor(
    payload: PaymentNotificationPayload,
  ): Promise<void> {
    const { status, donorEmail, donorName, amount, currency, invoiceId } =
      payload;

    if (!donorEmail) {
      return;
    }

    const subject =
      status === 'paid'
        ? 'Thank you for your donation!'
        : status === 'failed'
          ? 'Payment Failed - Action Required'
          : 'Payment Pending';

    const message =
      status === 'paid'
        ? `Dear ${donorName || 'Donor'},\n\nThank you for your generous donation of ${amount} ${currency}.\n\nYour payment has been successfully processed. Invoice ID: ${invoiceId}\n\nWe appreciate your support!`
        : status === 'failed'
          ? `Dear ${donorName || 'Donor'},\n\nUnfortunately, your payment of ${amount} ${currency} could not be processed.\n\nPlease try again or contact support if you continue to experience issues.\n\nInvoice ID: ${invoiceId}`
          : `Dear ${donorName || 'Donor'},\n\nYour payment of ${amount} ${currency} is currently pending.\n\nWe will notify you once the payment is confirmed.\n\nInvoice ID: ${invoiceId}`;

    // TODO: Integrate with email service (e.g., SendGrid, AWS SES, etc.)
    // For now, we'll just log it
    this.logger.log(
      `[EMAIL] To: ${donorEmail}, Subject: ${subject}\n${message}`,
    );

    // Example integration (uncomment when email service is configured):
    // await this.emailService.send({
    //   to: donorEmail,
    //   subject,
    //   text: message,
    //   html: this.generateHtmlEmail(subject, message),
    // });
  }

  /**
   * Notify admin about payment status change
   */
  private async notifyAdmin(
    payload: PaymentNotificationPayload,
  ): Promise<void> {
    const { status, paymentId, invoiceId, amount, currency, donorName } =
      payload;

    const subject = `Payment ${status.toUpperCase()}: ${invoiceId}`;
    const message = `Payment Status Update:\n\nPayment ID: ${paymentId}\nInvoice ID: ${invoiceId}\nStatus: ${status.toUpperCase()}\nAmount: ${amount} ${currency}\nDonor: ${donorName || 'Anonymous'}\n\nPlease review in the admin dashboard.`;

    // TODO: Integrate with admin notification system (e.g., Slack, email, etc.)
    // For now, we'll just log it
    this.logger.log(`[ADMIN NOTIFICATION] ${subject}\n${message}`);

    // Example integration (uncomment when notification system is configured):
    // await this.adminNotificationService.send({
    //   channel: 'payments',
    //   subject,
    //   message,
    // });
  }

  /**
   * Generate receipt for successful payment
   */
  async generateReceipt(payload: PaymentNotificationPayload): Promise<string> {
    const { invoiceId, amount, currency, donorName, donationIds } = payload;

    const receipt = `
═══════════════════════════════════════
           DONATION RECEIPT
═══════════════════════════════════════

Invoice ID: ${invoiceId}
Date: ${new Date().toLocaleString()}
Donor: ${donorName || 'Anonymous'}

Amount: ${amount} ${currency}

Donation IDs: ${donationIds.join(', ')}

Status: PAID

Thank you for your generous contribution!

═══════════════════════════════════════
    `;

    this.logger.log(`Receipt generated for invoice ${invoiceId}`);
    return receipt;
  }
}
