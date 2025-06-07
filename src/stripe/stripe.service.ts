import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Donation } from '../donations/entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import Stripe from 'stripe';
import {
  PaymentCreateInput,
  PaymentResult,
} from '../common/interfaces/payment-service.interface';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';

/**
 * Service handling Stripe payment operations
 * Based on Stripe Checkout Integration docs:
 * https://stripe.com/docs/payments/checkout
 */
@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {
    const apiKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!apiKey) {
      throw new Error('Stripe secret key not configured');
    }
    this.stripe = new Stripe(apiKey, { apiVersion: '2025-05-28.basil' });
  }

  /**
   * Create a Stripe Checkout session for a donation
   * Reference: https://stripe.com/docs/payments/checkout
   */
  async createPayment(input: PaymentCreateInput): Promise<PaymentResult> {
    const successUrl = this.config.get<string>('STRIPE_SUCCESS_URL');
    const cancelUrl = this.config.get<string>('STRIPE_CANCEL_URL');
    if (!successUrl || !cancelUrl) {
      throw new BadRequestException('Stripe URLs not configured');
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: Math.round(input.amount * 100),
            product_data: { name: `Donation for ${input.projectTitle}` },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${successUrl}/${input.donationId}`,
      cancel_url: `${cancelUrl}/${input.donationId}`,
    });

    return {
      id: session.id,
      url: session.url!,
      status: this.mapStatus(session.status ?? 'unknown'),
    };
  }

  /**
   * Construct and verify a Stripe webhook event
   * Reference: https://stripe.com/docs/webhooks/signatures
   */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new BadRequestException('Missing Stripe webhook secret');
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }

  /**
   * Process a successful Stripe payment
   */
  async handlePaymentSucceeded(sessionId: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const donation = await this.donationRepo.findOne({
        where: { paymentId: sessionId },
        relations: ['project'],
      });
      if (!donation) throw new BadRequestException('Donation not found');

      donation.status = DonationStatusEnum.COMPLETED;
      donation.paidAt = new Date();
      await qr.manager.save(donation);

      if (donation.project) {
        donation.project.currentAmount += donation.amount;
        donation.project.donationCount += 1;
        await qr.manager.save(donation.project);
      }

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw new BadRequestException(
        `Failed to process payment: ${err instanceof Error ? err.message : 'Unknown'}`,
      );
    } finally {
      await qr.release();
    }
  }

  /**
   * Mark a Stripe payment as failed
   */
  async handlePaymentFailed(sessionId: string): Promise<void> {
    const result = await this.donationRepo.update(
      { paymentId: sessionId, status: DonationStatusEnum.PENDING },
      { status: DonationStatusEnum.FAILED },
    );
    if (result.affected === 0) {
      throw new ForbiddenException('No pending donation updated');
    }
  }

  /**
   * Retrieve Stripe payment status
   */
  async getPaymentStatus(id: string): Promise<PaymentResult> {
    const session = await this.stripe.checkout.sessions.retrieve(id);
    const intentId = session.payment_intent as string;
    const intent = intentId
      ? await this.stripe.paymentIntents.retrieve(intentId)
      : null;

    return {
      id,
      status: this.mapStatus(session.status ?? 'unknown'),
      amount: session.amount_total! / 100,
      currency: session.currency!.toUpperCase(),
      paymentMethod: 'STRIPE',
      metadata: { paymentIntentStatus: intent?.status },
    };
  }

  private mapStatus(status: string): PaymentResult['status'] {
    switch (status) {
      case 'open':
      case 'created':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'paid':
      case 'complete':
        return 'completed';
      default:
        return 'failed';
    }
  }
}
