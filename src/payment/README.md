# Payment Module

A flexible, provider-agnostic payment module for NestJS applications. Supports multiple payment providers (MyFatoorah, Stripe, PayMob) with a unified API.

---

## Features

- **Multi-Provider Support**: Works with MyFatoorah, Stripe, PayMob, and any custom provider
- **Provider-Agnostic**: Switch between providers without changing your code
- **Flexible**: Use with any entity type (orders, donations, subscriptions, etc.)
- **Portable**: Easy to migrate to other projects
- **Well-Documented**: Comprehensive documentation and examples
- **Type-Safe**: Full TypeScript support

---

## Quick Start

### 1. Installation

```bash
# Copy payment module to your project
cp -r src/payment /path/to/your/project/src/

# Install dependencies
npm install @nestjs/typeorm @nestjs/schedule axios
```

### 2. Import Module

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [PaymentModule],
})
export class AppModule {}
```

### 3. Configure Environment Variables

```env
# MyFatoorah (example)
MYFATOORAH_API_KEY=your_api_key
MYFATOORAH_API_URL=https://apitest.myfatoorah.com
MYFATOORAH_CALLBACK_URL=https://yourdomain.com/payment/success
MYFATOORAH_ERROR_URL=https://yourdomain.com/payment/error
```

### 4. Use PaymentService

```typescript
import { PaymentService } from './payment/payment.service';

@Injectable()
export class OrdersService {
  constructor(private readonly paymentService: PaymentService) {}

  async createOrder(orderData: any) {
    // Create payment
    const payment = await this.paymentService.createPayment({
      amount: orderData.totalAmount,
      currency: orderData.currency,
      referenceId: orderData.id,
      description: `Order #${orderData.id}`,
      customerEmail: orderData.customerEmail,
      customerName: orderData.customerName,
    });

    // Redirect user to payment URL
    return { paymentUrl: payment.url };
  }
}
```

---

## Documentation

### Core Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./common/docs/API_REFERENCE.md) | Complete API documentation for all methods and functions |
| [Setup Guide](./common/docs/SETUP_GUIDE.md) | Step-by-step setup instructions |
| [Order Integration Guide](./common/docs/ORDER_INTEGRATION_GUIDE.md) | How to integrate with orders (products, courses, subscriptions) |
| [Migration Guide](./MIGRATION_IMPORTS_FIX.md) | How to migrate payment module to another project |

### Provider-Specific Documentation

| Document | Description |
|----------|-------------|
| [MyFatoorah Guide](./common/docs/myfatoorah.md) | Complete MyFatoorah setup and usage |
| [Stripe Guide](./common/docs/stripe.md) | Complete Stripe setup and usage |
| [PayMob Guide](./common/docs/paymob.md) | Complete PayMob setup and usage |

### Examples

| Document | Description |
|----------|-------------|
| [Examples](./common/docs/examples.md) | Ready-to-use code examples for common scenarios |
| [Order Integration Examples](./common/examples/order-payment-integration.example.ts) | Complete examples for order integration |

---

## Helper Functions

The module provides helper functions for common payment operations:

```typescript
import {
  createPaymentForOrder,
  handlePaymentWebhook,
  reconcilePayment,
  getAvailablePaymentMethods,
  checkProviderHealth,
} from './payment/common/utils/payment.utils';
```

See [API Reference](./common/docs/API_REFERENCE.md#helper-functions) for complete documentation.

---

## Core Methods

### Create Payment

```typescript
const result = await paymentService.createPayment({
  amount: 100,
  currency: 'KWD',
  referenceId: 'order-123',
  description: 'Payment for order #123',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
});
```

### Get Payment Status

```typescript
const status = await paymentService.getPaymentStatus('invoice-id-123');
// status.outcome: 'paid' | 'failed' | 'pending'
```

### Get Available Payment Methods

```typescript
const methods = await paymentService.getAvailablePaymentMethods(100, 'KWD');
// methods.paymentMethods: Array of available payment methods
```

### Health Check

```typescript
const health = await paymentService.healthCheck('myfatoorah');
// health.status: 'healthy' | 'unhealthy' | 'not_configured'
```

---

## Project Structure

```
src/payment/
├── payment.module.ts              # Main module configuration
├── payment.service.ts             # Core payment service
├── payment-methods.controller.ts  # API endpoints for payment methods
├── webhook.controller.ts          # Webhook handlers
├── entities/
│   └── payment.entity.ts          # Payment database entity
├── providers/
│   ├── myfatoora.provider.ts      # MyFatoorah provider
│   ├── stripe.provider.ts         # Stripe provider
│   └── paymob.provider.ts         # PayMob provider
├── common/
│   ├── interfaces/                # TypeScript interfaces
│   ├── services/                  # Shared services
│   ├── utils/
│   │   └── payment.helpers.ts     # Helper functions ⭐
│   ├── cron/                      # Reconciliation cron jobs
│   └── docs/                      # Documentation
│       ├── API_REFERENCE.md        # Complete API reference ⭐
│       ├── SETUP_GUIDE.md         # Setup instructions ⭐
│       ├── ORDER_INTEGRATION_GUIDE.md
│       ├── myfatoorah.md
│       ├── stripe.md
│       ├── paymob.md
│       └── examples.md
└── README.md                      # This file
```

---

## Migration to Another Project

When migrating the payment module to another project:

1. **Copy the module**: Copy entire `src/payment/` folder
2. **Fix imports**: See [MIGRATION_IMPORTS_FIX.md](./MIGRATION_IMPORTS_FIX.md)
3. **Configure providers**: Set environment variables
4. **Create webhook handler**: Create your own webhook controller
5. **Test**: Run health checks and test payment creation

See [MIGRATION_IMPORTS_FIX.md](./MIGRATION_IMPORTS_FIX.md) for detailed instructions.

---

## Support

- **Documentation**: See `common/docs/` folder
- **Examples**: See `common/examples/` folder
- **API Reference**: [API_REFERENCE.md](./common/docs/API_REFERENCE.md)
- **Setup Guide**: [SETUP_GUIDE.md](./common/docs/SETUP_GUIDE.md)

---

## License

This module is part of your project and follows the same license.

