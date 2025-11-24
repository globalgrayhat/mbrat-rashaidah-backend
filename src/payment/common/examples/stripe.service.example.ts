/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/**
 * EXAMPLE: How to add a new payment provider (Stripe)
 *
 * This is a complete example showing how to implement a new payment provider.
 * Copy this file and adapt it for your payment provider.
 *
 * Steps:
 * 1. Create a new service file (e.g., stripe.service.ts)
 * 2. Implement IPaymentProvider interface
 * 3. Register it in PaymentModule
 * 4. Use it via PaymentService
 */

import { Injectable } from '@nestjs/common';
import {
  IPaymentProvider,
  PaymentStatusResult,
  AvailablePaymentMethodsResponse,
  PaymentWebhookEvent,
  ProviderPaymentMethod,
} from '../interfaces/payment-provider.interface';
import {
  PaymentPayload,
  PaymentResult,
} from '../interfaces/payment-service.interface';

/**
 * Stripe Payment Provider Implementation
 *
 * This is an example implementation. Replace with actual Stripe SDK calls.
 */
@Injectable()
export class StripeService implements IPaymentProvider {
  readonly providerName = 'stripe';
  readonly providerVersion = '1.0.0';

  constructor() {} // private readonly stripeConfig: StripeConfig, // Inject your Stripe configuration

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    // Check if Stripe API key is configured
    // return !!this.stripeConfig.apiKey;
    return true; // Example
  }

  /**
   * Create a payment intent
   */
  async createPayment(
    payload: PaymentPayload & { paymentMethodId?: string | number },
  ): Promise<PaymentResult> {
    const { amount, currency, referenceId, description, customerEmail } =
      payload;

    // Example: Create Stripe Payment Intent
    // const paymentIntent = await this.stripe.paymentIntents.create({
    //   amount: amount * 100, // Convert to cents
    //   currency: currency.toLowerCase(),
    //   description,
    //   metadata: {
    //     referenceId, // Your internal reference (orderId, donationId, etc.)
    //   },
    // });

    // Return standardized result
    return {
      id: 'pi_example_123', // paymentIntent.id
      url: 'https://checkout.stripe.com/pay/...', // paymentIntent.client_secret
      status: 'pending',
      rawResponse: {}, // paymentIntent
    };
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    transactionId: string,
    keyType?: string,
  ): Promise<PaymentStatusResult> {
    // Example: Retrieve Stripe Payment Intent
    // const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);

    // Map Stripe status to our standard status
    const statusMap: Record<string, 'paid' | 'failed' | 'pending'> = {
      succeeded: 'paid',
      failed: 'failed',
      canceled: 'failed',
      processing: 'pending',
      requires_payment_method: 'pending',
      requires_confirmation: 'pending',
      requires_action: 'pending',
    };

    return {
      outcome: statusMap['succeeded'] || 'pending', // paymentIntent.status
      transactionId,
      paymentId: 'ch_example_123', // paymentIntent.latest_charge
      amount: 100, // paymentIntent.amount / 100
      currency: 'usd', // paymentIntent.currency
      raw: {}, // paymentIntent
    };
  }

  /**
   * Get available payment methods
   */
  async getAvailablePaymentMethods(
    invoiceAmount: number,
    currencyIso: string,
  ): Promise<AvailablePaymentMethodsResponse> {
    // Stripe supports: card, apple_pay, google_pay, etc.
    const paymentMethods: ProviderPaymentMethod[] = [
      {
        id: 'card',
        code: 'CARD',
        nameEn: 'Credit/Debit Card',
        nameAr: 'بطاقة ائتمان/خصم',
        isDirectPayment: false,
        serviceCharge: 0,
        totalAmount: invoiceAmount,
        currency: currencyIso,
      },
      {
        id: 'apple_pay',
        code: 'APPLE_PAY',
        nameEn: 'Apple Pay',
        nameAr: 'ابل باي',
        isDirectPayment: true,
        serviceCharge: 0,
        totalAmount: invoiceAmount,
        currency: currencyIso,
      },
      {
        id: 'google_pay',
        code: 'GOOGLE_PAY',
        nameEn: 'Google Pay',
        nameAr: 'جوجل باي',
        isDirectPayment: true,
        serviceCharge: 0,
        totalAmount: invoiceAmount,
        currency: currencyIso,
      },
    ];

    return {
      success: true,
      paymentMethods,
      invoiceAmount,
      currency: currencyIso,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handle Stripe webhook
   */
  async handleWebhook(webhookData: any): Promise<PaymentWebhookEvent> {
    // Example: Parse Stripe webhook event
    // const event = webhookData as Stripe.Event;

    const statusMap: Record<
      string,
      'paid' | 'failed' | 'pending' | 'canceled'
    > = {
      'payment_intent.succeeded': 'paid',
      'payment_intent.payment_failed': 'failed',
      'payment_intent.canceled': 'canceled',
      'payment_intent.processing': 'pending',
    };

    return {
      eventType: 'payment_intent.succeeded', // event.type
      transactionId: 'pi_example_123', // event.data.object.id
      status: 'paid', // Map from event.type
      amount: 100, // event.data.object.amount / 100
      currency: 'usd', // event.data.object.currency
      customerInfo: {
        email: 'customer@example.com', // event.data.object.customer
      },
      rawData: webhookData,
      timestamp: new Date().toISOString(), // event.created
    };
  }

  /**
   * Validate Stripe webhook signature
   */
  async validateWebhook(webhookData: any): Promise<boolean> {
    // Example: Validate Stripe webhook signature
    // const signature = headers['stripe-signature'];
    // return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return true; // Example
  }
}
