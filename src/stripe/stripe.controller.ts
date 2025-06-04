import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UsePipes,
  UseGuards,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import Stripe from 'stripe';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
import { donationExistsPipe } from '../common/pipes/donationExists.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';

@Controller('stripe')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StripeController {
  constructor(private readonly stripe: StripeService) {}

  @Post('webhook')
  async handleWebhook(@Req() req: Request) {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event;
    try {
      event = this.stripe.constructEvent(req.body, sig);
    } catch (error) {
      throw new BadRequestException(`Webhook Error: ${error.message}`);
    }

    const session: Stripe.Checkout.Session = event.data.object;

    console.log('type: ', event.type, ' id: ', session.id);

    try {
      // Handle the event
      if (event.type === 'checkout.session.completed') {
        await this.stripe.handlePaymentSucceeded(session.id);
      }
    } catch (error) {
      console.log(`Webhook Error: ${error.message}`);
    }
  }

  @Get('payment/:id')
  async getPaymentStatus(@Param('id') paymentId: string) {
    return this.stripe.getPaymentStatus(paymentId);
  }

  @Get('success/:donationId')
  @UsePipes(donationExistsPipe)
  handleSuccess(@Param('donationId', ParseIntPipe) donationId: string) {
    return {
      donationId,
      code: HttpStatus.OK,
      message: 'successful payment',
      DonationStatus: DonationStatusEnum.SUCCESSFUL,
    };
  }

  @Get('cancel/:donationId')
  @UsePipes(donationExistsPipe)
  async handleFailure(@Param('donationId', ParseIntPipe) donationId: string) {
    await this.stripe.handlePaymentFailed(donationId);

    return {
      donationId,
      code: HttpStatus.EXPECTATION_FAILED,
      message: 'Canceled Payment',
      DonationStatus: DonationStatusEnum.FAILED,
    };
  }
}
