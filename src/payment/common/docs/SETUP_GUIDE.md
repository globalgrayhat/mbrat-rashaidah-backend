# Payment Module Setup Guide

Complete step-by-step guide for setting up the Payment module in your NestJS project.

---

## Table of Contents

1. [Installation](#installation)
2. [Module Configuration](#module-configuration)
3. [Environment Variables](#environment-variables)
4. [Provider Setup](#provider-setup)
5. [Database Setup](#database-setup)
6. [Webhook Configuration](#webhook-configuration)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Installation

### Step 1: Copy Payment Module

Copy the entire `src/payment/` folder to your project:

```bash
# From your current project
cp -r src/payment /path/to/new/project/src/
```

### Step 2: Install Dependencies

Ensure you have the required packages installed:

```bash
npm install @nestjs/typeorm @nestjs/schedule
npm install axios
npm install class-validator class-transformer
```

### Step 3: Import PaymentModule

Add `PaymentModule` to your `AppModule`:

```typescript
// src/app.module.ts
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

## Module Configuration

### Basic Configuration

The Payment module is designed to work with minimal configuration. However, you may need to adjust imports based on your project structure.

#### Remove External Dependencies (if not available)

If your project doesn't have `AppConfigModule`, `NotificationService`, etc., remove them from `payment.module.ts`:

```typescript
// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Internal imports only
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
// ... other internal imports

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    ScheduleModule.forRoot(),
    // Remove AppConfigModule if not available
    // Remove DonationsModule if not available
  ],
  // ... rest of configuration
})
export class PaymentModule {}
```

See [MIGRATION_IMPORTS_FIX.md](../../MIGRATION_IMPORTS_FIX.md) for detailed instructions.

---

## Environment Variables

### MyFatoorah Configuration

Add these variables to your `.env` file:

```env
# MyFatoorah API Configuration
MYFATOORAH_API_KEY=your_api_key_here
MYFATOORAH_API_URL=https://apitest.myfatoorah.com
MYFATOORAH_CALLBACK_URL=https://yourdomain.com/payment/success
MYFATOORAH_ERROR_URL=https://yourdomain.com/payment/error

# Optional: Invoice TTL (default: 60 minutes)
MYFATOORAH_INVOICE_TTL_MINUTES=60
```

**For Production:**
- Use `https://api.myfatoorah.com` instead of `https://apitest.myfatoorah.com`
- Get your production API key from MyFatoorah dashboard

### Stripe Configuration

```env
# Stripe API Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Optional: Stripe API Version
STRIPE_API_VERSION=2023-10-16
```

**For Production:**
- Use `sk_live_...` instead of `sk_test_...`
- Get your keys from Stripe dashboard

### PayMob Configuration

```env
# PayMob API Configuration (Intention API - Recommended)
PAYMOB_SECRET_KEY=your_secret_key_here
PAYMOB_COUNTRY=EGYPT
PAYMOB_INTEGRATION_ID=your_integration_id_here
PAYMOB_IFRAME_ID=your_iframe_id_here
PAYMOB_CALLBACK_URL=https://yourdomain.com/payment/callback

# Optional: Legacy API (if not using Intention API)
PAYMOB_API_KEY=your_api_key_here
```

### Active Provider Selection

```env
# Optional: Set default active provider
# If not set, uses first configured provider
PAYMENT_PROVIDER=myfatoorah
```

---

## Provider Setup

### MyFatoorah Setup

1. **Get API Key:**
   - Sign up at [MyFatoorah](https://www.myfatoorah.com/)
   - Go to Settings > API Keys
   - Copy your API key

2. **Configure Callback URLs:**
   - Set `MYFATOORAH_CALLBACK_URL` to your success page
   - Set `MYFATOORAH_ERROR_URL` to your error page

3. **Test Configuration:**
   ```typescript
   const health = await paymentService.healthCheck('myfatoorah');
   console.log(health.status); // Should be 'healthy'
   ```

### Stripe Setup

1. **Get API Keys:**
   - Sign up at [Stripe](https://stripe.com/)
   - Go to Developers > API Keys
   - Copy your Secret Key

2. **Configure Webhook:**
   - Go to Developers > Webhooks
   - Add endpoint: `https://yourdomain.com/webhooks/stripe`
   - Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

3. **Test Configuration:**
   ```typescript
   const health = await paymentService.healthCheck('stripe');
   console.log(health.status); // Should be 'healthy'
   ```

### PayMob Setup

1. **Get Credentials:**
   - Sign up at [PayMob](https://www.paymob.com/)
   - Go to Settings > API Credentials
   - Copy your Secret Key and Integration ID

2. **Configure Callback:**
   - Set `PAYMOB_CALLBACK_URL` to your callback endpoint

3. **Test Configuration:**
   ```typescript
   const health = await paymentService.healthCheck('paymob');
   console.log(health.status); // Should be 'healthy'
   ```

---

## Database Setup

### Payment Entity Migration

The Payment entity is already defined. You need to create a migration:

```bash
npm run typeorm:migration:generate -- -n CreatePaymentTable
```

Or manually create the migration:

```sql
CREATE TABLE IF NOT EXISTS `payments` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `amount` DECIMAL(15, 3) NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  `paymentMethod` VARCHAR(50) NOT NULL,
  `transactionId` VARCHAR(255) NOT NULL UNIQUE,
  `paymentUrl` VARCHAR(500) NULL,
  `status` VARCHAR(50) NOT NULL,
  `rawResponse` JSON NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_payments_status` (`status`),
  INDEX `idx_payments_paymentMethod` (`paymentMethod`),
  INDEX `idx_payments_currency` (`currency`),
  INDEX `idx_payments_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### TypeORM Configuration

Ensure TypeORM is configured to load the Payment entity:

```typescript
// src/app.module.ts or database config
TypeOrmModule.forRoot({
  // ... other config
  entities: [
    // ... other entities
    Payment,
  ],
})
```

---

## Webhook Configuration

### MyFatoorah Webhook

1. **Configure Webhook URL in MyFatoorah Dashboard:**
   - Go to Settings > Webhooks
   - Add webhook URL: `https://yourdomain.com/webhooks/myfatoora`
   - Select events: Payment Status Changed

2. **Create Webhook Controller (if not using default):**

```typescript
// src/orders/webhooks/order-payment.webhook.ts
import { Controller, Post, Body } from '@nestjs/common';
import { PaymentService } from '../../payment/payment.service';
import { OrdersService } from '../orders.service';

@Controller('webhooks/payment')
export class OrderPaymentWebhookController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post('myfatoora')
  async handleMyFatooraWebhook(@Body() event: any) {
    const invoiceId = event.Data?.InvoiceId || event.InvoiceId;
    const statusResult = await this.paymentService.getPaymentStatus(invoiceId);
    
    await this.ordersService.handlePaymentWebhook(invoiceId, statusResult);
    
    return { success: true };
  }
}
```

### Stripe Webhook

1. **Configure Webhook in Stripe Dashboard:**
   - Go to Developers > Webhooks
   - Add endpoint: `https://yourdomain.com/webhooks/stripe`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`

2. **Verify Webhook Signature:**

```typescript
@Post('stripe')
async handleStripeWebhook(@Body() event: any, @Headers('stripe-signature') signature: string) {
  // Verify signature using STRIPE_WEBHOOK_SECRET
  const verifiedEvent = await this.paymentService.handleWebhook(event, 'stripe');
  // Process event
}
```

### PayMob Webhook

1. **Configure Webhook in PayMob Dashboard:**
   - Go to Settings > Webhooks
   - Add webhook URL: `https://yourdomain.com/webhooks/paymob`

---

## Testing

### Test Payment Creation

```typescript
// test/payment.e2e-spec.ts
describe('Payment Module', () => {
  it('should create payment', async () => {
    const result = await paymentService.createPayment({
      amount: 10,
      currency: 'KWD',
      referenceId: 'test-order-123',
      description: 'Test payment',
      customerEmail: 'test@example.com',
    });

    expect(result.id).toBeDefined();
    expect(result.url).toBeDefined();
    expect(result.status).toBe('pending');
  });
});
```

### Test Provider Health

```typescript
it('should check provider health', async () => {
  const health = await paymentService.healthCheck('myfatoorah');
  expect(health.status).toBe('healthy');
});
```

### Test Webhook Handling

```typescript
it('should handle webhook', async () => {
  const webhookData = {
    InvoiceId: 'test-invoice-id',
    InvoiceStatus: 2, // Paid
    // ... other webhook data
  };

  const event = await paymentService.handleWebhook(webhookData, 'myfatoorah');
  expect(event.status).toBe('paid');
});
```

---

## Troubleshooting

### Common Issues

#### 1. "Provider is not configured"

**Problem:** Provider is not properly configured.

**Solution:**
- Check environment variables are set correctly
- Verify API keys are valid
- Check provider health: `await paymentService.healthCheck('provider-name')`

#### 2. "No active provider"

**Problem:** No provider is configured or active.

**Solution:**
- Configure at least one provider (MyFatoorah, Stripe, or PayMob)
- Set `PAYMENT_PROVIDER` environment variable
- Or specify provider in each request: `createPayment(payload, 'myfatoorah')`

#### 3. "Payment not found"

**Problem:** Payment transaction ID doesn't exist.

**Solution:**
- Verify transaction ID is correct
- Check if payment exists in provider dashboard
- Payment may have expired

#### 4. "Webhook not received"

**Problem:** Webhooks are not being received.

**Solution:**
- Verify webhook URL is correctly configured in provider dashboard
- Check webhook URL is publicly accessible
- Verify webhook secret (for Stripe)
- Check server logs for webhook requests

#### 5. "Import errors when migrating"

**Problem:** Import errors when copying payment module to new project.

**Solution:**
- See [MIGRATION_IMPORTS_FIX.md](../../MIGRATION_IMPORTS_FIX.md)
- Remove external dependencies from `payment.module.ts`
- Create mock services if needed

---

## Next Steps

1. **Read API Reference:** [API_REFERENCE.md](./API_REFERENCE.md)
2. **Check Provider Handbooks:** [myfatoorah.md](./myfatoorah.md), [stripe.md](./stripe.md), [paymob.md](./paymob.md)
3. **See Integration Examples:** [ORDER_INTEGRATION_GUIDE.md](./ORDER_INTEGRATION_GUIDE.md)
4. **Review Utility Functions:** [payment.utils.ts](../utils/payment.utils.ts)

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review provider-specific documentation
3. Check code examples in [examples.md](./examples.md)

