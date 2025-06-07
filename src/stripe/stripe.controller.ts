import {
  Controller,
  Post,
  Req,
  Get,
  Param,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
import { donationExistsPipe } from '../common/pipes/donationExists.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

/**
 * Controller for Stripe payment endpoints
 * Based on Stripe Checkout and Webhook Integration:
 * https://stripe.com/docs/payments/checkout, https://stripe.com/docs/webhooks
 */
@Controller('stripe')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  /**
   * Stripe webhook endpoint to receive payment events
   */
  @Post('webhook')
  async handleWebhook(@Req() req: Request): Promise<{ status: number }> {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature header');
    }

    // Construct event from raw body buffer
    const event: Stripe.Event = this.stripeService.constructEvent(
      req.body as Buffer,
      signature as string,
    );

    // Handle checkout session completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await this.stripeService.handlePaymentSucceeded(session.id);
    }

    return { status: HttpStatus.OK };
  }

  /**
   * Get Stripe payment status by session ID
   */
  @Get('status/:id')
  async getStatus(
    @Param('id') sessionId: string,
  ): Promise<ReturnType<StripeService['getPaymentStatus']>> {
    return this.stripeService.getPaymentStatus(sessionId);
  }

  /**
   * Redirect after successful payment
   */
  @Get('success/:donationId')
  async handleSuccess(@Param('donationId') donationId: string): Promise<{
    donationId: string;
    code: number;
    message: string;
    DonationStatus: DonationStatusEnum;
  }> {
    // Validate donation exists
    await new donationExistsPipe(this.stripeService['donationRepo']).transform(
      donationId,
    );
    return {
      donationId,
      code: HttpStatus.OK,
      message: 'Payment successful',
      DonationStatus: DonationStatusEnum.COMPLETED,
    };
  }

  /**
   * Redirect after cancelled payment
   */
  @Get('cancel/:donationId')
  async handleCancel(@Param('donationId') donationId: string): Promise<{
    donationId: string;
    code: number;
    message: string;
    DonationStatus: DonationStatusEnum;
  }> {
    // Validate donation exists
    await new donationExistsPipe(this.stripeService['donationRepo']).transform(
      donationId,
    );

    // Mark payment as failed
    await this.stripeService.handlePaymentFailed(donationId);

    return {
      donationId,
      code: HttpStatus.EXPECTATION_FAILED,
      message: 'Payment canceled',
      DonationStatus: DonationStatusEnum.FAILED,
    };
  }
}
