import {
  Controller,
  Post,
  Body,
  //   Req,
  //   Res,
  //   RawBodyRequest,
} from '@nestjs/common';
import { DonationsService } from '../donations/donations.service';
import { PaymentMethodEnum } from '../common/constants/payment.constant';
import {
  //   StripeWebhookEvent,
  MyFatooraWebhookEvent,
} from '../common/interfaces/payment-service.interface';
import { Request, Response } from 'express';
// import Stripe from 'stripe'; // If you're using Stripe's SDK for webhook verification
// import { ConfigService } from '@nestjs/config';

@Controller('webhooks') // A dedicated path for all webhooks
export class WebhookController {
  constructor(
    private readonly donationsService: DonationsService,
    // private readonly configService: ConfigService, // For Stripe secret
  ) {}

  // For Stripe, you need the raw body to verify the signature
  // Ensure you configure `app.use(json({ verify: rawBodyBuffer }));` in main.ts
  //   @Post('stripe')
  //   async handleStripeWebhook(
  //     @Req() req: RawBodyRequest<Request>,
  //     @Res() res: Response,
  //   ) {
  //     // const sig = req.headers['stripe-signature'];
  // const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

  // try {
  //   const event: StripeWebhookEvent = this.stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  //   // Process the event
  //   if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
  //     await this.donationsService.handlePaymentWebhook(PaymentMethodEnum.STRIPE, event);
  //   } else {
  //     console.log(`Received unhandled Stripe event type: ${event.type}`);
  //   }
  //   return res.status(200).send({ received: true });
  // } catch (err) {
  //   console.error(`Stripe webhook error: ${err.message}`);
  //   return res.status(400).send(`Webhook Error: ${err.message}`);
  // }

  // Mock processing without signature verification for now:
  //     const event: StripeWebhookEvent = req.body;
  //     const eventType = event.type;
  //     try {
  //       if (
  //         eventType === 'checkout.session.completed' ||
  //         eventType === 'payment_intent.payment_failed' ||
  //         eventType === 'payment_intent.succeeded'
  //       ) {
  //         await this.donationsService.handlePaymentWebhook(
  //           PaymentMethodEnum.STRIPE,
  //           event,
  //         );
  //       } else {
  //         console.log(`Received unhandled Stripe event type: ${eventType}`);
  //       }
  //       return res.status(200).send({ received: true });
  //     } catch (err) {
  //       console.error(`Stripe webhook error: ${err.message}`);
  //       return res.status(400).send(`Webhook Error: ${err.message}`);
  //     }
  //   }

  @Post('myfatoora')
  async handleMyFatooraWebhook(@Body() event: MyFatooraWebhookEvent) {
    try {
      await this.donationsService.handlePaymentWebhook(
        PaymentMethodEnum.MYFATOORA,
        event,
      );
      return { received: true };
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      console.error(`MyFatoora webhook error: ${message}`);
      throw err; // Let NestJS handle the HTTP exception
    }
  }
}
