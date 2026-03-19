/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Invoice Service
 *
 * Provides a unified, professional way to retrieve invoice details.
 * Follows a DB-first strategy: if the local Payment record has a terminal
 * status (paid / failed), it is returned immediately without hitting
 * MyFatoorah. If the status is still pending (or the record is missing),
 * the service fetches the latest data from MyFatoorah, upserts the local
 * record, and returns a normalised Invoice object.
 *
 * This keeps the frontend completely decoupled from MyFatoorah.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentService } from './payment.service';
import { Invoice, InvoiceItem } from './common/interfaces/invoice.interface';

// Optional: Import Donation for itemized breakdown
// This import is project-specific — remove when migrating
import { Donation } from '../donations/entities/donation.entity';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Donation)
    private readonly donationRepository: Repository<Donation>,
    private readonly paymentService: PaymentService,
  ) {}

  // ─── public API ────────────────────────────────────────────

  /**
   * Get invoice details by MyFatoorah InvoiceId.
   * DB-first: returns cached data for terminal statuses.
   * Falls back to MyFatoorah for pending / missing invoices.
   */
  async getInvoiceByInvoiceId(invoiceId: string): Promise<Invoice> {
    // Step 1 — Validate input
    if (!invoiceId || !invoiceId.trim()) {
      throw new BadRequestException(
        'Invoice ID is required. Please provide a valid InvoiceId.',
      );
    }

    const trimmedId = invoiceId.trim();

    // Step 2 — Look up the local Payment record
    let payment = await this.paymentRepository.findOne({
      where: { transactionId: trimmedId },
    });

    // Step 3 — Determine if we need to refresh from MyFatoorah
    const needsRefresh = !payment || this.isPending(payment.status);

    if (needsRefresh) {
      payment = await this.refreshFromProvider(trimmedId, payment);
    }

    if (!payment) {
      throw new NotFoundException(
        `Invoice not found for InvoiceId: ${trimmedId}. ` +
          'Please verify the InvoiceId and try again.',
      );
    }

    // Step 4 — Fetch associated donation items for itemised breakdown
    const items = await this.getInvoiceItems(payment.id);

    // Step 5 — Build and return the normalised Invoice
    return this.buildInvoice(payment, items);
  }

  /**
   * Get invoice details by MyFatoorah PaymentId.
   * Resolves the InvoiceId via MyFatoorah, then delegates to getInvoiceByInvoiceId.
   */
  async getInvoiceByPaymentId(paymentId: string): Promise<Invoice> {
    if (!paymentId || !paymentId.trim()) {
      throw new BadRequestException(
        'Payment ID is required. Please provide a valid PaymentId.',
      );
    }

    // Check local DB first by mfPaymentId
    const localPayment = await this.paymentRepository.findOne({
      where: { mfPaymentId: paymentId.trim() },
    });

    if (localPayment) {
      return this.getInvoiceByInvoiceId(localPayment.transactionId);
    }

    // Not found locally — ask MyFatoorah to resolve InvoiceId
    try {
      const statusResult = await this.paymentService.getPaymentStatus(
        paymentId.trim(),
      );
      if (statusResult.transactionId) {
        return this.getInvoiceByInvoiceId(statusResult.transactionId);
      }
    } catch {
      // Provider lookup failed — nothing we can do
    }

    throw new NotFoundException(
      `Invoice not found for PaymentId: ${paymentId}. ` +
        'Please verify the PaymentId and try again.',
    );
  }

  // ─── private helpers ───────────────────────────────────────

  /**
   * Refresh payment data from the active payment provider (MyFatoorah).
   * If the provider returns updated data, the local record is upserted.
   */
  private async refreshFromProvider(
    invoiceId: string,
    existingPayment: Payment | null,
  ): Promise<Payment | null> {
    try {
      const statusResult =
        await this.paymentService.getPaymentStatus(invoiceId);

      if (!statusResult) return existingPayment;

      // Extract customer info from raw response
      const raw = statusResult.raw;
      const customerName = raw?.CustomerName || undefined;
      const customerEmail = raw?.CustomerEmail || undefined;
      const customerMobile = raw?.CustomerMobile || undefined;

      // Extract MyFatoorah PaymentId
      const mfPaymentId = statusResult.paymentId
        ? String(statusResult.paymentId)
        : raw?.Payments?.[0]?.PaymentId
          ? String(raw.Payments[0].PaymentId)
          : undefined;

      // Map outcome to stored status
      const newStatus = this.mapOutcomeToStatus(statusResult.outcome);

      if (existingPayment) {
        // Upsert: update the existing record
        const updates: Partial<Payment> = {
          status: newStatus,
          rawResponse: raw,
        };

        // Only update customer info if it wasn't set yet
        if (!existingPayment.customerName && customerName) {
          updates.customerName = customerName;
        }
        if (!existingPayment.customerEmail && customerEmail) {
          updates.customerEmail = customerEmail;
        }
        if (!existingPayment.customerMobile && customerMobile) {
          updates.customerMobile = customerMobile;
        }
        if (!existingPayment.mfPaymentId && mfPaymentId) {
          updates.mfPaymentId = mfPaymentId;
        }

        await this.paymentRepository.update(existingPayment.id, updates);

        this.logger.log(
          `Invoice ${invoiceId}: status updated from "${existingPayment.status}" to "${newStatus}"`,
        );

        // Return the refreshed record
        return this.paymentRepository.findOne({
          where: { id: existingPayment.id },
        });
      }

      // Payment doesn't exist locally — we won't create orphan records.
      // The DonationsService workflow always creates Payment + Donation together.
      // Just return null and let the caller handle NotFoundException.
      this.logger.debug(
        `Invoice ${invoiceId}: no local Payment record found. Cannot auto-create.`,
      );
      return null;
    } catch (error) {
      // If MyFatoorah lookup fails, return whatever we have locally
      this.logger.warn(
        `Invoice ${invoiceId}: provider refresh failed — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return existingPayment;
    }
  }

  /**
   * Fetch donation line items linked to a given Payment UUID.
   * Returns an InvoiceItem[] array for the itemised breakdown.
   */
  private async getInvoiceItems(paymentId: string): Promise<InvoiceItem[]> {
    try {
      const donations = await this.donationRepository.find({
        where: { paymentId },
        relations: ['project', 'campaign'],
      });

      if (!donations.length) return [];

      const totalAmount = donations.reduce(
        (sum, d) => sum + Number(d.amount),
        0,
      );

      return donations.map((d) => {
        const amount = Number(d.amount);
        const name =
          d.project?.title || d.campaign?.title || 'General Donation';
        const type: InvoiceItem['type'] = d.projectId
          ? 'project'
          : d.campaignId
            ? 'campaign'
            : 'other';
        const percentage =
          totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0;

        return { name, type, amount, percentage };
      });
    } catch (error) {
      this.logger.warn(
        `Failed to fetch invoice items for payment ${paymentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  /**
   * Build a normalised Invoice response from a Payment entity + items.
   */
  private buildInvoice(payment: Payment, items: InvoiceItem[]): Invoice {
    const dateObj = payment.createdAt || new Date();
    const status = this.normalizeStatus(payment.status);

    // Human-friendly status labels
    const statusLabels: Record<string, string> = {
      paid: 'Success',
      failed: 'Failed',
      pending: 'Pending',
    };

    // Try to extract customer info from rawResponse as fallback
    const raw = payment.rawResponse;
    const customerName =
      payment.customerName || raw?.CustomerName || undefined;
    const customerEmail =
      payment.customerEmail || raw?.CustomerEmail || undefined;
    const customerMobile =
      payment.customerMobile || raw?.CustomerMobile || undefined;

    // Extract payment method
    const paymentMethod =
      payment.paymentMethod ||
      raw?.Payments?.[0]?.PaymentMethod ||
      undefined;

    return {
      invoiceId: payment.transactionId,
      paymentId: payment.id,
      status,
      outcome: status, // alias of status for frontend compatibility
      statusLabel: statusLabels[status] || status,
      totalAmount: Number(payment.amount),
      currency: payment.currency,
      items,
      customer: {
        name: customerName,
        email: customerEmail,
        mobile: customerMobile,
      },
      date: dateObj.toISOString().split('T')[0],
      time: dateObj.toTimeString().split(' ')[0],
      provider: 'myfatoorah',
      mfPaymentId: payment.mfPaymentId || undefined,
      paymentMethod,
      updatedAt: (payment.updatedAt || dateObj).toISOString(),
    };
  }

  // ─── tiny utilities ────────────────────────────────────────

  /** Check if a status string represents a pending payment */
  private isPending(status: string): boolean {
    const s = status?.toLowerCase().trim();
    return s === 'pending' || s === '' || !s;
  }

  /** Normalize any stored status string to the Invoice union type */
  private normalizeStatus(status: string): 'pending' | 'paid' | 'failed' {
    const s = (status || '').toLowerCase().trim();
    if (s === 'paid' || s === 'success' || s === 'completed') return 'paid';
    if (s === 'failed' || s === 'failure' || s === 'error' || s === 'canceled')
      return 'failed';
    return 'pending';
  }

  /** Map provider outcome to a stored status string */
  private mapOutcomeToStatus(outcome: string): string {
    const map: Record<string, string> = {
      paid: 'paid',
      failed: 'failed',
      pending: 'pending',
    };
    return map[outcome] || outcome;
  }
}
