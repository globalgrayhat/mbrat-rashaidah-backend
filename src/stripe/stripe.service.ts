// [FIXED 2025-06-04]
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Donation,
  DonationStatusEnum,
} from '../donations/entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import { Stripe } from 'stripe';
import {
  PaymentCreateInput,
  PaymentResult,
} from '../common/interfaces/payment-service.interface';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Donation)
    private donationRepo: Repository<Donation>,
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    private config: ConfigService,
  ) {
    const STRIPE_SECRET_KEY =
      this.config.get<string>('STRIPE_SECRET_KEY') || '';

    this.stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil',
    });
  }

  async createPayment(input: PaymentCreateInput): Promise<PaymentResult> {
    try {
      const success_url = this.config.get<string>('STRIPE_SUCCESS_URL');
      const cancel_url = this.config.get<string>('STRIPE_CANCEL_URL');

      if (!success_url || !cancel_url) {
        throw new Error('Missing Stripe configuration');
      }

      const session = await this.stripe.checkout.sessions.create({
        line_items: [
          {
            quantity: 1,
            price_data: {
              unit_amount: Math.round(input.amount * 100), // Convert to cents
              currency: input.currency.toLowerCase(),
              product_data: {
                name: `Donation for ${input.projectTitle}`,
              },
            },
          },
        ],
        mode: 'payment',
        success_url: `${success_url}/${input.donationId}`,
        cancel_url: `${cancel_url}/${input.donationId}`,
      });

      return {
        id: session.id,
        url: session.url || '',
        status: this.mapStripeStatus(session.status || 'pending'),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to create Stripe payment: ${error.message}`,
        );
      }
      throw new BadRequestException('Failed to create Stripe payment');
    }
  }

  async constructEvent(payload: Buffer, sig: string | string[]) {
    try {
      const STRIPE_WEBHOOK_SECRET = this.config.get<string>(
        'STRIPE_WEBHOOK_SECRET',
      );
      if (!STRIPE_WEBHOOK_SECRET) {
        throw new Error('Missing webhook secret');
      }

      const event = await Promise.resolve(
        this.stripe.webhooks.constructEvent(
          payload,
          Array.isArray(sig) ? sig[0] : sig,
          STRIPE_WEBHOOK_SECRET,
        ),
      );

      return event;
    } catch (err) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async handlePaymentSucceeded(paymentId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const donation = await this.donationRepo.findOne({
        where: { paymentId },
        relations: ['project'],
      });

      if (!donation) {
        throw new BadRequestException('Payment not found');
      }

      // Update donation status
      donation.status = DonationStatusEnum.COMPLETED;
      donation.paidAt = new Date();
      await queryRunner.manager.save(donation);

      // Update project totals
      if (donation.project) {
        const project = donation.project;
        project.currentAmount =
          Number(project.currentAmount || 0) + Number(donation.amount);
        project.donationCount = (project.donationCount || 0) + 1;
        await queryRunner.manager.save(project);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        'Failed to process payment: ' +
          (err instanceof Error ? err.message : 'Unknown error'),
      );
    } finally {
      await queryRunner.release();
    }
  }

  async handlePaymentFailed(paymentId: string) {
    try {
      const result = await this.donationRepo.update(
        { paymentId, status: DonationStatusEnum.PENDING },
        { status: DonationStatusEnum.FAILED },
      );

      if (result.affected === 0) {
        throw new Error('No donation updated');
      }
    } catch (err) {
      throw new ForbiddenException(
        'Failed to update payment status: ' +
          (err instanceof Error ? err.message : 'Unknown error'),
      );
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentResult> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(paymentId);
      const paymentIntent = session.payment_intent 
        ? await this.stripe.paymentIntents.retrieve(session.payment_intent as string)
        : null;

      return {
        id: paymentId,
        status: this.mapStripeStatus(session.status || 'pending'),
        amount: session.amount_total ? session.amount_total / 100 : 0, // Convert from cents
        currency: session.currency?.toUpperCase() || 'USD',
        paymentMethod: 'STRIPE',
        metadata: {
          paymentIntentStatus: paymentIntent?.status,
          customerEmail: session.customer_email,
          paymentDate: session.payment_status === 'paid' ? new Date().toISOString() : undefined,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to get payment status: ${error.message}`,
        );
      }
      throw new BadRequestException('Failed to get payment status');
    }
  }

  private mapStripeStatus(stripeStatus: string): PaymentResult['status'] {
    switch (stripeStatus) {
      case 'open':
      case 'created':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'complete':
      case 'paid':
        return 'completed';
      default:
        return 'failed';
    }
  }
}
