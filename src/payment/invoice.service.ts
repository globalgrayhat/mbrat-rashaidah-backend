/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { forwardRef, Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentService } from './payment.service';
import { Invoice, InvoiceItem } from './common/interfaces/invoice.interface';
import { Donation } from '../donations/entities/donation.entity';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
import { DonationsService } from '../donations/donations.service';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Donation)
    private readonly donationRepository: Repository<Donation>,
    private readonly paymentService: PaymentService,
    @Inject(forwardRef(() => DonationsService))
    private readonly donationsService: DonationsService,
  ) {}

  async getInvoiceByInvoiceId(invoiceId: string): Promise<Invoice> {
    if (!invoiceId || !invoiceId.trim()) {
      throw new BadRequestException('Invoice ID is required.');
    }

    const trimmedId = invoiceId.trim();
    let payment = await this.paymentRepository.findOne({
      where: { transactionId: trimmedId },
    });

    // If payment exists but is pending or incomplete, refresh via DonationsService
    // DonationsService.reconcilePayment handles Payment status, Donation status, and Project totals
    if (payment && (this.isPending(payment.status) || !payment.mfPaymentId)) {
      try {
        await this.donationsService.reconcilePayment(trimmedId, 'InvoiceId');
        // Reload payment to get updated status and info
        payment = await this.paymentRepository.findOne({
          where: { transactionId: trimmedId },
        });
      } catch (e) {
        this.logger.warn(`Failed to reconcile payment for ${trimmedId}: ${e.message}`);
      }
    }

    // If payment still not found in database, try full reconciliation (Deep Recovery)
    if (!payment) {
      try {
        await this.donationsService.reconcilePayment(trimmedId, 'InvoiceId');
        payment = await this.paymentRepository.findOne({
          where: { transactionId: trimmedId },
        });
      } catch (e) {
        // ignore
      }
    }

    if (!payment) {
      throw new NotFoundException(
        `Invoice not found for InvoiceId: ${trimmedId}`,
      );
    }

    let items = await this.getInvoiceItems(payment.id);
    if (!items.length) {
      let referenceId: string | undefined;
      try {
        const statusResult = await this.paymentService.getPaymentStatus(
          payment.transactionId,
          'InvoiceId',
        );
        referenceId = statusResult?.referenceId;
      } catch (e) {
        // ignore
      }
      items = await this.findAndLinkDonations(payment, referenceId);
    }

    return this.buildInvoice(payment, items);
  }

  async getInvoiceByPaymentId(paymentId: string): Promise<Invoice> {
    if (!paymentId || !paymentId.trim()) {
      throw new BadRequestException('Payment ID is required.');
    }

    const paymentIdTrimmed = paymentId.trim();
    let localPayment = await this.paymentRepository.findOne({
      where: { mfPaymentId: paymentIdTrimmed },
    });

    if (localPayment) {
      return this.getInvoiceByInvoiceId(localPayment.transactionId);
    }

    localPayment = await this.paymentRepository.findOne({
      where: { transactionId: paymentIdTrimmed },
    });

    if (localPayment) {
      return this.getInvoiceByInvoiceId(paymentIdTrimmed);
    }

    try {
      const statusResult = await this.paymentService.getPaymentStatus(
        paymentIdTrimmed,
        'PaymentId',
      );
      if (statusResult.transactionId) {
        return this.getInvoiceByInvoiceId(statusResult.transactionId);
      }
    } catch {
      // ignore
    }

    throw new NotFoundException(
      `Invoice not found for PaymentId: ${paymentId}`,
    );
  }

  private async findAndLinkDonations(
    payment: Payment,
    referenceId?: string,
  ): Promise<InvoiceItem[]> {
    try {
      const amount = Number(payment.amount);
      if (!amount || amount <= 0) return [];

      let donations = await this.donationRepository.find({
        where: { paymentId: payment.id },
        relations: ['project', 'campaign'],
      });

      // If no donations found by paymentId, try searching by referenceId (donationId)
      if (donations.length === 0 && referenceId) {
        const firstDonation = await this.donationRepository.findOne({
          where: { id: referenceId },
          relations: ['payment'],
        });

        if (firstDonation) {
          // If this donation is already linked to another payment, use that payment's donations
          const targetPaymentId = firstDonation.paymentId || payment.id;
          
          // Find all donations that were created in the same batch (sharing the same createdAt or donor)
          // For now, let's just find the ones that might belong to this payment
          donations = await this.donationRepository.find({
            where: [
              { paymentId: targetPaymentId },
              { id: referenceId }
            ],
            relations: ['project', 'campaign'],
          });
          
          // If we found the donation but it's not linked, link it now
          if (donations.length > 0 && !donations[0].paymentId) {
            for (const d of donations) {
              d.paymentId = payment.id;
              d.payment = payment;
            }
            await this.donationRepository.save(donations);
          }
        }
      }

      // Fallback: search by amount (only reliable for single-item donations)
      if (donations.length === 0) {
        donations = await this.donationRepository
          .createQueryBuilder('d')
          .where('d.amount = :amount', { amount })
          .andWhere('(d.paymentId IS NULL OR d.paymentId = :paymentId)', {
            paymentId: payment.id,
          })
          .andWhere('d.status IN (:...statuses)', {
            statuses: [
              DonationStatusEnum.PENDING,
              DonationStatusEnum.PAID,
              DonationStatusEnum.SUCCESSFUL,
              DonationStatusEnum.COMPLETED,
            ],
          })
          .leftJoinAndSelect('d.project', 'project')
          .leftJoinAndSelect('d.campaign', 'campaign')
          .orderBy('d.createdAt', 'DESC')
          .getMany();
      }

      // Final fallback: just get anything linked to this paymentId without relations loaded
      if (donations.length === 0) {
          donations = await this.donationRepository.find({
              where: { paymentId: payment.id },
              relations: ['project', 'campaign']
          });
      }

      if (donations.length === 0) return [];

      const totalAmount = donations.reduce(
        (sum, d) => sum + Number(d.amount),
        0,
      );
      return donations.map((d) => ({
        name: d.project?.title || d.campaign?.title || 'General Donation',
        type: d.projectId ? 'project' : d.campaignId ? 'campaign' : 'other',
        amount: Number(d.amount),
        percentage:
          totalAmount > 0
            ? Math.round((Number(d.amount) / totalAmount) * 100)
            : 0,
      }));
    } catch (error) {
      this.logger.warn(`findAndLinkDonations failed: ${error}`);
      return [];
    }
  }

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
      return donations.map((d) => ({
        name: d.project?.title || d.campaign?.title || 'General Donation',
        type: d.projectId ? 'project' : d.campaignId ? 'campaign' : 'other',
        amount: Number(d.amount),
        percentage:
          totalAmount > 0
            ? Math.round((Number(d.amount) / totalAmount) * 100)
            : 0,
      }));
    } catch {
      return [];
    }
  }

  private buildInvoice(payment: Payment, items: InvoiceItem[]): Invoice {
    const dateObj = payment.createdAt || new Date();
    const status = this.normalizeStatus(payment.status);
    const statusLabels: Record<string, string> = {
      paid: 'Success',
      failed: 'Failed',
      pending: 'Pending',
    };
    const raw = payment.rawResponse;
    const customerName = payment.customerName || raw?.CustomerName || undefined;
    const customerEmail =
      payment.customerEmail || raw?.CustomerEmail || undefined;
    const customerMobile =
      payment.customerMobile || raw?.CustomerMobile || undefined;

    return {
      invoiceId: payment.transactionId,
      paymentId: payment.id,
      status,
      outcome: status,
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
      mfPaymentId: payment.mfPaymentId,
      paymentMethod: payment.paymentMethod,
      updatedAt: (payment.updatedAt || dateObj).toISOString(),
    };
  }

  private isPending(status: string): boolean {
    const s = status?.toLowerCase().trim();
    return s === 'pending' || s === '' || !s;
  }

  private normalizeStatus(status: string): 'pending' | 'paid' | 'failed' {
    const s = (status || '').toLowerCase().trim();
    if (s === 'paid' || s === 'success' || s === 'completed') return 'paid';
    if (s === 'failed' || s === 'failure' || s === 'error' || s === 'canceled')
      return 'failed';
    return 'pending';
  }

  private mapOutcomeToStatus(outcome: string): string {
    const map: Record<string, string> = {
      paid: 'paid',
      failed: 'failed',
      pending: 'pending',
    };
    return map[outcome] || outcome;
  }
}
