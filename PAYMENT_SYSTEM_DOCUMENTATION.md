# Payment System - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [Configuration](#configuration)
5. [Usage Examples](#usage-examples)
6. [Adding New Payment Providers](#adding-new-payment-providers)
7. [API Reference](#api-reference)
8. [Migration Guide](#migration-guide)

---

## Overview

The Payment System is a **portable, flexible, and DRY** payment processing solution that supports multiple payment gateways (MyFatoorah, Stripe, PayMob, etc.) without code duplication.

### Key Features

✅ **Multi-Provider Support**: Easily switch between payment providers  
✅ **Portable**: Can be used in any project (e-commerce, donations, subscriptions, etc.)  
✅ **DRY Principle**: No code duplication  
✅ **Simple & Flexible**: Easy to understand and maintain  
✅ **Performance Optimized**: Efficient and scalable  
✅ **Type-Safe**: Full TypeScript support with comprehensive interfaces  

---

## Architecture

### Core Components

```
src/
├── common/
│   └── interfaces/
│       ├── payment-provider.interface.ts    # Universal provider interface
│       └── payment-service.interface.ts      # Payment payload & result types
├── payment/
│   ├── payment.service.ts                    # Payment manager (main service)
│   ├── myfatoora.service.ts                  # MyFatoorah provider implementation
│   ├── interfaces/
│   │   └── myfatoorah-config.interface.ts   # MyFatoorah configuration
│   └── examples/
│       ├── stripe.service.example.ts         # Example: Adding Stripe
│       └── ADD_NEW_PROVIDER.md              # Guide for new providers
```

### Design Pattern

The system follows the **Strategy Pattern**:
- `IPaymentProvider`: Universal interface for all providers
- `PaymentService`: Manages multiple providers
- Provider implementations: MyFatooraService, StripeService, etc.

---

## Installation & Setup

### Step 1: Copy Required Files

Copy these files to your project:

```
src/common/interfaces/
├── payment-provider.interface.ts
└── payment-service.interface.ts

src/payment/
├── payment.service.ts
├── myfatoora.service.ts
├── interfaces/
│   └── myfatoorah-config.interface.ts
└── payment.module.ts
```

### Step 2: Install Dependencies

```bash
npm install @nestjs/common @nestjs/config axios
```

### Step 3: Configure Environment Variables

Create a `.env` file:

```env
# MyFatoorah Configuration (Required)
MYFATOORAH_API_KEY=your_api_key_here
MYFATOORAH_CALLBACK_URL=https://your-domain.com/payment/success
MYFATOORAH_ERROR_URL=https://your-domain.com/payment/error

# MyFatoorah Configuration (Optional - with defaults)
MYFATOORAH_API_URL=https://apitest.myfatoorah.com/v2/
MYFATOORAH_INVOICE_TTL_MINUTES=60
MYFATOORAH_TZ=Asia/Kuwait
MYFATOORAH_TTL_SKEW_SECONDS=30

# Active Payment Provider (Optional)
PAYMENT_PROVIDER=myfatoorah
```

### Step 4: Register Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    PaymentModule,
    // ... other modules
  ],
})
export class AppModule {}
```

---

## Configuration

### Option 1: Environment Variables (Simplest)

MyFatooraService automatically reads from environment variables:

```typescript
// payment.module.ts
@Module({
  providers: [
    MyFatooraService, // Reads from process.env automatically
    PaymentService,
  ],
})
export class PaymentModule {}
```

### Option 2: Direct Configuration Object

```typescript
// payment.module.ts
import { MyFatooraService } from './myfatoora.service';
import { IMyFatoorahConfig } from './interfaces/myfatoorah-config.interface';

@Module({
  providers: [
    {
      provide: MyFatooraService,
      useFactory: () => {
        const config: IMyFatoorahConfig = {
          apiKey: process.env.MYFATOORAH_API_KEY || '',
          apiUrl: process.env.MYFATOORAH_API_URL,
          callbackUrl: process.env.MYFATOORAH_CALLBACK_URL,
          errorUrl: process.env.MYFATOORAH_ERROR_URL,
          invoiceTtlMinutes: 60,
          timezone: 'Asia/Kuwait',
          ttlSkewSeconds: 30,
        };
        return new MyFatooraService(config);
      },
    },
    PaymentService,
  ],
})
export class PaymentModule {}
```

### Option 3: Custom Config Service

```typescript
// payment.module.ts
import { MyFatooraService } from './myfatoora.service';
import { AppConfigService } from './config/config.service';

@Module({
  providers: [
    {
      provide: MyFatooraService,
      useFactory: (config: AppConfigService) => {
        return new MyFatooraService(config);
      },
      inject: [AppConfigService],
    },
    PaymentService,
  ],
})
export class PaymentModule {}
```

---

## Usage Examples

### Example 1: E-Commerce Order Payment

```typescript
// order.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class OrderService {
  constructor(private readonly paymentService: PaymentService) {}

  async createOrder(orderDto: CreateOrderDto) {
    // Create order in database
    const order = await this.orderRepository.save({
      total: orderDto.total,
      currency: orderDto.currency,
      // ... other fields
    });

    // Create payment
    const payment = await this.paymentService.createPayment({
      amount: order.total,
      currency: order.currency,
      referenceId: order.id, // orderId
      description: `Order #${order.id}`,
      customerName: orderDto.customerName,
      customerEmail: orderDto.customerEmail,
      customerMobile: orderDto.customerPhone,
      paymentMethodId: orderDto.paymentMethodId,
      metadata: {
        orderType: 'premium',
        items: orderDto.items,
        shippingAddress: orderDto.shippingAddress,
      },
    });

    // Update order with payment info
    order.paymentId = payment.id;
    order.paymentUrl = payment.url;
    await this.orderRepository.save(order);

    return {
      order,
      paymentUrl: payment.url,
    };
  }

  async checkPaymentStatus(orderId: string) {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    
    if (!order?.paymentId) {
      throw new NotFoundException('Payment not found');
    }

    const status = await this.paymentService.getPaymentStatus(
      order.paymentId,
      'InvoiceId',
    );

    // Update order status based on payment
    if (status.outcome === 'paid') {
      order.status = 'paid';
      await this.orderRepository.save(order);
    }

    return status;
  }
}
```

### Example 2: Donation Platform

```typescript
// donation.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class DonationService {
  constructor(private readonly paymentService: PaymentService) {}

  async createDonation(donationDto: CreateDonationDto) {
    // Create donation record
    const donation = await this.donationRepository.save({
      amount: donationDto.amount,
      currency: donationDto.currency,
      projectId: donationDto.projectId,
      // ... other fields
    });

    // Create payment
    const payment = await this.paymentService.createPayment({
      amount: donation.amount,
      currency: donation.currency,
      referenceId: donation.id, // donationId
      description: `Donation for Project ${donationDto.projectId}`,
      customerName: donationDto.donorName || 'Anonymous',
      customerEmail: donationDto.donorEmail,
      paymentMethodId: donationDto.paymentMethodId,
      metadata: {
        projectId: donationDto.projectId,
        isAnonymous: donationDto.isAnonymous,
      },
    });

    donation.paymentId = payment.id;
    donation.paymentUrl = payment.url;
    await this.donationRepository.save(donation);

    return {
      donation,
      paymentUrl: payment.url,
    };
  }
}
```

### Example 3: Subscription Service

```typescript
// subscription.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class SubscriptionService {
  constructor(private readonly paymentService: PaymentService) {}

  async createSubscription(subscriptionDto: CreateSubscriptionDto) {
    const subscription = await this.subscriptionRepository.save({
      planId: subscriptionDto.planId,
      amount: subscriptionDto.amount,
      currency: subscriptionDto.currency,
      // ... other fields
    });

    const payment = await this.paymentService.createPayment({
      amount: subscription.amount,
      currency: subscription.currency,
      referenceId: subscription.id, // subscriptionId
      description: `Subscription for Plan ${subscriptionDto.planId}`,
      customerEmail: subscriptionDto.customerEmail,
      metadata: {
        planId: subscriptionDto.planId,
        billingCycle: subscriptionDto.billingCycle,
      },
    });

    subscription.paymentId = payment.id;
    await this.subscriptionRepository.save(subscription);

    return payment;
  }
}
```

### Example 4: Get Available Payment Methods

```typescript
// payment-methods.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('available')
  async getAvailablePaymentMethods(
    @Query('amount') amount: string,
    @Query('currency') currency: string,
  ) {
    const invoiceAmount = parseFloat(amount) || 1.0;
    const currencyIso = currency || 'KWD';

    const methods = await this.paymentService.getAvailablePaymentMethods(
      invoiceAmount,
      currencyIso,
    );

    return {
      success: true,
      data: methods,
    };
  }
}
```

### Example 5: Handle Webhooks

```typescript
// webhook.controller.ts
import { Controller, Post, Body, Param } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':provider')
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() webhookData: any,
  ) {
    // Validate and process webhook
    const webhookEvent = await this.paymentService.handleWebhook(
      webhookData,
      provider as any,
    );

    // Process based on status
    if (webhookEvent.status === 'paid') {
      // Update your order/donation/subscription status
      await this.updatePaymentStatus(
        webhookEvent.transactionId,
        'paid',
      );
    }

    return { received: true, success: true };
  }

  private async updatePaymentStatus(
    transactionId: string,
    status: string,
  ) {
    // Your business logic here
    // e.g., update order/donation/subscription status
  }
}
```

---

## Adding New Payment Providers

### Step 1: Create Provider Service

```typescript
// stripe.service.ts
import { Injectable } from '@nestjs/common';
import { IPaymentProvider, ... } from '../common/interfaces/payment-provider.interface';
import { PaymentPayload, PaymentResult } from '../common/interfaces/payment-service.interface';

@Injectable()
export class StripeService implements IPaymentProvider {
  readonly providerName = 'stripe';
  readonly providerVersion = '1.0.0';

  constructor(
    // Inject your Stripe configuration
    private readonly stripeConfig: StripeConfig,
  ) {}

  isConfigured(): boolean {
    return !!this.stripeConfig.apiKey;
  }

  async createPayment(
    payload: PaymentPayload & { paymentMethodId?: string | number },
  ): Promise<PaymentResult> {
    // Implement Stripe payment creation
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: payload.amount * 100, // Convert to cents
      currency: payload.currency.toLowerCase(),
      description: payload.description,
      metadata: {
        referenceId: payload.referenceId,
      },
    });

    return {
      id: paymentIntent.id,
      url: paymentIntent.client_secret,
      status: 'pending',
      rawResponse: paymentIntent,
    };
  }

  async getPaymentStatus(
    transactionId: string,
    keyType?: string,
  ): Promise<PaymentStatusResult> {
    // Implement Stripe status check
    const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);

    const statusMap: Record<string, 'paid' | 'failed' | 'pending'> = {
      succeeded: 'paid',
      failed: 'failed',
      canceled: 'failed',
      processing: 'pending',
    };

    return {
      outcome: statusMap[paymentIntent.status] || 'pending',
      transactionId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      raw: paymentIntent,
    };
  }

  async getAvailablePaymentMethods(
    invoiceAmount: number,
    currencyIso: string,
  ): Promise<AvailablePaymentMethodsResponse> {
    // Return Stripe payment methods
    return {
      success: true,
      paymentMethods: [
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
        // ... more methods
      ],
      invoiceAmount,
      currency: currencyIso,
      timestamp: new Date().toISOString(),
    };
  }

  async handleWebhook(webhookData: any): Promise<PaymentWebhookEvent> {
    // Implement Stripe webhook handling
    const event = webhookData as Stripe.Event;

    return {
      eventType: event.type,
      transactionId: event.data.object.id,
      status: this.mapStripeStatus(event.type),
      amount: event.data.object.amount / 100,
      currency: event.data.object.currency,
      rawData: webhookData,
      timestamp: new Date(event.created * 1000).toISOString(),
    };
  }

  async validateWebhook(webhookData: any): Promise<boolean> {
    // Implement Stripe webhook validation
    return this.stripe.webhooks.constructEvent(
      webhookData,
      signature,
      webhookSecret,
    );
  }

  private mapStripeStatus(eventType: string): 'paid' | 'failed' | 'pending' | 'canceled' {
    // Map Stripe event types to our status
  }
}
```

### Step 2: Register Provider

```typescript
// payment.module.ts
import { StripeService } from './stripe.service';

@Module({
  providers: [
    MyFatooraService,
    StripeService, // Add new provider
    PaymentService,
  ],
})
export class PaymentModule {}
```

### Step 3: Use Provider

```typescript
// Use specific provider
const payment = await this.paymentService.createPayment(payload, 'stripe');

// Or set as active provider
this.paymentService.setActiveProvider('stripe');
const payment = await this.paymentService.createPayment(payload);
```

---

## API Reference

### PaymentService

#### `createPayment(payload, providerType?)`

Creates a payment using the active provider or a specific provider.

**Parameters:**
- `payload: PaymentPayload & { paymentMethodId?: string | number }`
- `providerType?: PaymentProviderType` (optional)

**Returns:** `Promise<PaymentResult>`

**Example:**
```typescript
const result = await paymentService.createPayment({
  amount: 100,
  currency: 'KWD',
  referenceId: 'order-123',
  description: 'Order payment',
  customerEmail: 'customer@example.com',
});
```

#### `getPaymentStatus(transactionId, keyType?, providerType?)`

Gets payment status from the provider.

**Parameters:**
- `transactionId: string`
- `keyType?: string` (optional, e.g., 'InvoiceId', 'PaymentId')
- `providerType?: PaymentProviderType` (optional)

**Returns:** `Promise<PaymentStatusResult>`

#### `getAvailablePaymentMethods(invoiceAmount, currencyIso, providerType?)`

Gets available payment methods with service charges.

**Parameters:**
- `invoiceAmount: number`
- `currencyIso: string`
- `providerType?: PaymentProviderType` (optional)

**Returns:** `Promise<AvailablePaymentMethodsResponse>`

#### `handleWebhook(webhookData, providerType)`

Handles webhook events from payment providers.

**Parameters:**
- `webhookData: any`
- `providerType: PaymentProviderType`

**Returns:** `Promise<PaymentWebhookEvent>`

#### `registerProvider(type, provider)`

Registers a new payment provider.

**Parameters:**
- `type: PaymentProviderType`
- `provider: IPaymentProvider`

#### `setActiveProvider(type)`

Sets the active payment provider.

**Parameters:**
- `type: PaymentProviderType`

---

## Migration Guide

### From Old System to New System

#### Step 1: Update PaymentPayload

**Old:**
```typescript
{
  donationId: 'donation-123',
  // ...
}
```

**New:**
```typescript
{
  referenceId: 'donation-123', // or orderId, subscriptionId, etc.
  // ...
}
```

#### Step 2: Update Service Calls

**Old:**
```typescript
const payment = await this.myFatooraService.createPayment(payload);
```

**New:**
```typescript
const payment = await this.paymentService.createPayment(payload);
```

#### Step 3: Update Status Checks

**Old:**
```typescript
const status = await this.myFatooraService.getPaymentStatus(invoiceId);
```

**New:**
```typescript
const status = await this.paymentService.getPaymentStatus(invoiceId);
```

---

## Best Practices

1. **Always use `referenceId`**: It's generic and works for any project type
2. **Use `metadata` for additional info**: Don't add project-specific fields to PaymentPayload
3. **Handle webhooks properly**: Always validate webhook signatures
4. **Error handling**: Wrap payment calls in try-catch blocks
5. **Logging**: Log all payment operations for debugging

---

## Support

For questions or issues, please refer to:
- `src/payment/README.md` - Quick start guide
- `src/payment/examples/` - Code examples
- `PAYMENT_ARCHITECTURE.md` - Architecture details

---

## License

This payment system is part of the project and follows the same license.

