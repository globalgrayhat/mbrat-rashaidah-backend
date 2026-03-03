# Payment Module API Reference

Complete API documentation for the Payment module. This document covers all available functions, methods, and utilities for working with payment providers.

---

## Table of Contents

1. [Core PaymentService Methods](#core-paymentservice-methods)
2. [Helper Functions](#helper-functions)
3. [Provider Management](#provider-management)
4. [Webhook Handling](#webhook-handling)
5. [Reconciliation](#reconciliation)
6. [Error Handling](#error-handling)

---

## Core PaymentService Methods

### `createPayment(payload, providerType?)`

Creates a payment transaction using the specified provider or the active provider.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `payload` | `PaymentPayload & { paymentMethodId?: string \| number }` | Yes | Payment creation payload |
| `providerType` | `PaymentProviderType` | No | Provider to use ('myfatoorah', 'stripe', 'paymob'). If not specified, uses active provider |

#### PaymentPayload Interface

```typescript
interface PaymentPayload {
  amount: number;              // Payment amount
  currency: string;            // Currency code (e.g., 'KWD', 'USD', 'EUR')
  referenceId: string;         // Generic reference ID (orderId, donationId, etc.)
  description: string;         // Payment description
  customerName?: string;       // Customer name (optional)
  customerEmail?: string;      // Customer email (optional)
  customerMobile?: string;     // Customer mobile (optional)
  metadata?: Record<string, any>; // Additional metadata (optional)
}
```

#### Returns

```typescript
Promise<PaymentResult>

interface PaymentResult {
  id: string;                  // Provider transaction ID (InvoiceId, PaymentIntentId, etc.)
  url?: string;                // Payment URL to redirect user
  status: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'paid';
  rawResponse: any;            // Raw response from provider
}
```

#### Example

```typescript
// Create payment with active provider
const result = await paymentService.createPayment({
  amount: 100,
  currency: 'KWD',
  referenceId: 'order-123',
  description: 'Payment for order #123',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  paymentMethodId: '1', // Optional: KNET for MyFatoorah
});

// Use specific provider
const result = await paymentService.createPayment(
  {
    amount: 100,
    currency: 'USD',
    referenceId: 'order-123',
    description: 'Payment for order #123',
    customerEmail: 'john@example.com',
  },
  'stripe', // Use Stripe provider
);
```

#### Throws

- `BadRequestException` - If provider is not available or payload is invalid
- `InternalServerErrorException` - If no active provider and none specified

---

### `getPaymentStatus(transactionId, providerType?)`

Retrieves the current status of a payment transaction. Automatically checks if payment has expired and marks it as 'failed' if expired and still 'pending'.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transactionId` | `string` | Yes | Transaction/Invoice ID from payment provider |
| `providerType` | `PaymentProviderType` | No | Provider type. If not specified, uses active provider |

#### Returns

```typescript
Promise<PaymentStatusResult>

interface PaymentStatusResult {
  outcome: 'paid' | 'failed' | 'pending';
  transactionId: string;
  amount: number;
  currency: string;
  raw: any;                    // Raw response from provider
}
```

#### Example

```typescript
// Get payment status with active provider
const status = await paymentService.getPaymentStatus('invoice-id-123');

if (status.outcome === 'paid') {
  // Process successful payment
  await orderService.markAsPaid(status.transactionId);
} else if (status.outcome === 'failed') {
  // Handle failed payment
  await orderService.markAsFailed(status.transactionId);
}

// Get status with specific provider
const status = await paymentService.getPaymentStatus(
  'payment-intent-id',
  'stripe',
);
```

#### Remarks

- Automatically checks payment expiry and marks expired payments as 'failed'
- Expiry check is provider-agnostic (works with all providers)
- Use this method to verify payment status after webhook or callback
- Status outcome can be: 'paid', 'failed', or 'pending'

---

### `getAvailablePaymentMethods(amount, currency, providerType?)`

Fetches available payment methods from the provider for a given amount and currency.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | `number` | Yes | Payment amount |
| `currency` | `string` | Yes | Currency code (e.g., 'KWD', 'USD') |
| `providerType` | `PaymentProviderType` | No | Provider type. If not specified, uses active provider |

#### Returns

```typescript
Promise<AvailablePaymentMethodsResponse>

interface AvailablePaymentMethodsResponse {
  success: boolean;
  paymentMethods: ProviderPaymentMethod[];
  invoiceAmount: number;
  currency: string;
  timestamp: string;
  fallback?: boolean;          // true if using fallback static list
  message?: string;            // Message if fallback is used
}

interface ProviderPaymentMethod {
  id: string | number;         // Payment method ID
  code: string;                // Payment method code
  nameEn: string;              // English name
  nameAr?: string;             // Arabic name (if available)
  isDirectPayment: boolean;
  serviceCharge: number;
  totalAmount: number;
  currency: string;
  imageUrl?: string;
  minLimit?: number;
  maxLimit?: number;
}
```

#### Example

```typescript
// Get available payment methods
const methods = await paymentService.getAvailablePaymentMethods(
  100,
  'KWD',
  'myfatoorah',
);

// Display methods to user
methods.paymentMethods.forEach(method => {
  console.log(`${method.nameEn} - ${method.totalAmount} ${method.currency}`);
});
```

---

### `handleWebhook(rawData, providerType)`

Normalizes webhook payloads from payment providers to a unified `PaymentWebhookEvent` format.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `rawData` | `any` | Yes | Raw webhook payload from provider |
| `providerType` | `PaymentProviderType` | Yes | Provider type ('myfatoorah', 'stripe', 'paymob') |

#### Returns

```typescript
Promise<PaymentWebhookEvent>

interface PaymentWebhookEvent {
  eventType: string;
  transactionId: string;
  status: 'paid' | 'failed' | 'pending';
  amount: number;
  currency: string;
  rawData: any;
  timestamp: string;
}
```

#### Example

```typescript
@Post('webhooks/myfatoora')
async handleMyFatooraWebhook(@Body() rawData: any) {
  const event = await paymentService.handleWebhook(rawData, 'myfatoorah');
  
  // Process webhook event
  if (event.status === 'paid') {
    await orderService.markAsPaid(event.transactionId);
  }
  
  return { success: true };
}
```

---

### `healthCheck(providerType?)`

Checks if a payment provider is healthy and properly configured.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `providerType` | `PaymentProviderType` | No | Provider type. If not specified, checks all providers |

#### Returns

```typescript
Promise<ProviderHealthCheckResult | ProviderHealthCheckResult[]>

interface ProviderHealthCheckResult {
  provider: PaymentProviderType;
  status: 'healthy' | 'unhealthy' | 'not_configured';
  message?: string;
  timestamp: string;
}
```

#### Example

```typescript
// Check specific provider
const health = await paymentService.healthCheck('myfatoorah');
if (health.status === 'healthy') {
  console.log('Provider is ready');
}

// Check all providers
const allHealth = await paymentService.healthCheck();
allHealth.forEach(h => {
  console.log(`${h.provider}: ${h.status}`);
});
```

---

## Helper Functions

The Payment module provides utility functions in `common/utils/payment.utils.ts` for common payment operations.

### `createPaymentForEntity(paymentService, paymentRepository, options)`

Creates a payment for an order/entity and saves it to the database.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `paymentService` | `PaymentService` | Yes | PaymentService instance |
| `paymentRepository` | `Repository<Payment>` | Yes | Payment repository |
| `options` | `CreatePaymentOptions` | Yes | Payment creation options |

#### CreatePaymentOptions Interface

```typescript
interface CreatePaymentOptions {
  entityId: string;            // Entity ID to link payment to (orderId, donationId, subscriptionId, etc.)
  amount: number;              // Payment amount
  currency: string;            // Currency code
  description: string;         // Payment description
  customerName: string;        // Customer name
  customerEmail: string;       // Customer email
  customerMobile?: string;     // Customer mobile (optional)
  paymentMethodId?: string | number; // Payment method ID (optional)
  provider?: PaymentProviderType;     // Provider to use (optional)
  metadata?: Record<string, any>;     // Additional metadata (optional)
}
```

#### Returns

```typescript
Promise<CreatePaymentResult>

interface CreatePaymentResult {
  payment: Payment;            // Payment entity saved in database
  paymentUrl: string;          // Payment URL to redirect user to
  invoiceId: string;           // Provider transaction ID
  paymentId: string;           // Payment ID (database UUID)
}
```

#### Example

```typescript
import { createPaymentForEntity } from './payment/common/utils/payment.utils';

const result = await createPaymentForEntity(
  paymentService,
  paymentRepository,
  {
    entityId: 'order-123', // or 'donation-123', 'subscription-123', etc.
    amount: 100,
    currency: 'KWD',
    description: 'Order #123',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    paymentMethodId: '1', // KNET
  }
);

// Redirect user to payment URL
return { redirectUrl: result.paymentUrl };
```

---

### `handlePaymentWebhook(paymentService, paymentRepository, invoiceId, callbacks?)`

Handles payment webhooks from providers.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `paymentService` | `PaymentService` | Yes | PaymentService instance |
| `paymentRepository` | `Repository<Payment>` | Yes | Payment repository |
| `invoiceId` | `string` | Yes | Provider transaction ID |
| `callbacks` | `WebhookCallbacks` | No | Webhook callbacks (onPaid, onFailed, onPending) |

#### WebhookCallbacks Interface

```typescript
interface WebhookCallbacks {
  onPaid?: (payment: Payment, statusResult: PaymentStatusResult) => Promise<void>;
  onFailed?: (payment: Payment, statusResult: PaymentStatusResult) => Promise<void>;
  onPending?: (payment: Payment, statusResult: PaymentStatusResult) => Promise<void>;
}
```

#### Returns

```typescript
Promise<{
  success: boolean;
  paymentId: string;
  status: string;
}>
```

#### Example

```typescript
import { handlePaymentWebhook } from './payment/common/utils/payment.utils';

await handlePaymentWebhook(
  paymentService,
  paymentRepository,
  invoiceId,
  {
    onPaid: async (payment, statusResult) => {
      // Update order status to paid
      await orderRepository.update(
        { paymentId: payment.id },
        { status: 'paid', paidAt: new Date() }
      );
    },
    onFailed: async (payment, statusResult) => {
      // Update order status to failed
      await orderRepository.update(
        { paymentId: payment.id },
        { status: 'failed' }
      );
    },
  }
);
```

---

### `reconcilePayment(paymentService, paymentRepository, paymentId, callbacks?)`

Manually checks payment status with the provider. Useful for on-demand status checks, cron jobs, or admin actions.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `paymentService` | `PaymentService` | Yes | PaymentService instance |
| `paymentRepository` | `Repository<Payment>` | Yes | Payment repository |
| `paymentId` | `string` | Yes | Payment ID (database UUID) or transaction ID |
| `callbacks` | `WebhookCallbacks` | No | Optional callbacks for status changes |

#### Returns

```typescript
Promise<{
  paymentId: string;
  status: string;
  updated: boolean;
}>
```

#### Example

```typescript
import { reconcilePayment } from './payment/common/utils/payment.helpers';

const result = await reconcilePayment(
  paymentService,
  paymentRepository,
  paymentId,
  {
    onPaid: async (payment) => {
      await updateOrderStatus(payment.id, 'paid');
    },
  }
);
```

---

### `getAvailablePaymentMethods(paymentService, amount, currency, provider?)`

Fetches available payment methods from the provider.

#### Example

```typescript
import { getAvailablePaymentMethods } from './payment/common/utils/payment.helpers';

const methods = await getAvailablePaymentMethods(
  paymentService,
  100,
  'KWD',
  'myfatoorah'
);
```

---

### `checkProviderHealth(paymentService, provider?)`

Checks if a payment provider is healthy and configured.

#### Example

```typescript
import { checkProviderHealth } from './payment/common/utils/payment.helpers';

const health = await checkProviderHealth(paymentService, 'myfatoorah');
```

---

### `getPaymentById(paymentRepository, id)`

Finds payment by either database ID or provider transaction ID.

#### Example

```typescript
import { getPaymentById } from './payment/common/utils/payment.helpers';

const payment = await getPaymentById(paymentRepository, paymentId);
```

---

### `getPaymentsByStatus(paymentRepository, status)`

Fetches all payments with a specific status.

#### Example

```typescript
import { getPaymentsByStatus } from './payment/common/utils/payment.helpers';

const pendingPayments = await getPaymentsByStatus(
  paymentRepository,
  'pending'
);
```

---

### `getPaymentsForEntity(paymentRepository, entityId, referenceType?)`

Fetches all payments linked to a specific order/entity.

#### Example

```typescript
import { getPaymentsForOrder } from './payment/common/utils/payment.helpers';

const payments = await getPaymentsForEntity(
  paymentRepository,
  entityId,
  'order' // or 'donation', 'subscription', etc.
);
```

---

## Provider Management

### `registerProvider(type, provider, skipConfigCheck?)`

Registers a payment provider with the service.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | `PaymentProviderType` | Yes | Provider type identifier |
| `provider` | `IPaymentProvider` | Yes | Provider implementation |
| `skipConfigCheck` | `boolean` | No | If true, register provider even if not configured |

#### Example

```typescript
const customProvider = new CustomPaymentProvider(config);
paymentService.registerProvider('custom', customProvider);
```

---

### `setActiveProvider(type)`

Sets the active provider for payment operations.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | `PaymentProviderType` | Yes | Provider type to set as active |

#### Example

```typescript
paymentService.setActiveProvider('stripe');
```

---

### `getActiveProvider()`

Gets the currently active provider.

#### Returns

```typescript
IPaymentProvider
```

#### Example

```typescript
const activeProvider = paymentService.getActiveProvider();
console.log(activeProvider.providerName);
```

---

### `getRegisteredProviders()`

Gets all registered provider types.

#### Returns

```typescript
PaymentProviderType[]
```

#### Example

```typescript
const providers = paymentService.getRegisteredProviders();
// Returns: ['myfatoorah', 'stripe', 'paymob']
```

---

## Error Handling

### Common Exceptions

| Exception | When Thrown | Solution |
|-----------|-------------|----------|
| `BadRequestException` | Invalid payload or provider not available | Check payload format and provider configuration |
| `InternalServerErrorException` | No active provider and none specified | Configure at least one provider or specify provider in request |
| `NotFoundException` | Payment not found | Verify transaction ID |
| `UnauthorizedException` | Provider authentication failed | Check API keys and credentials |

### Error Handling Example

```typescript
try {
  const result = await paymentService.createPayment(payload);
} catch (error) {
  if (error instanceof BadRequestException) {
    // Handle bad request
    console.error('Invalid payment request:', error.message);
  } else if (error instanceof InternalServerErrorException) {
    // Handle server error
    console.error('Payment service error:', error.message);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

---

## Type Definitions

### PaymentProviderType

```typescript
type PaymentProviderType = 'myfatoorah' | 'stripe' | 'paymob';
```

### Payment Status

```typescript
type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled' | 'paid';
```

---

## See Also

- [Setup Guide](./README.md#3-setup-checklist)
- [Provider Handbooks](./myfatoorah.md)
- [Order Integration Guide](./ORDER_INTEGRATION_GUIDE.md)
- [Examples](./examples.md)

