# Payment Platform Documentation (2025 Edition)

> **Scope:** Everything under `src/payment/` (service layer, providers, cron, docs).  
> **Audience:** Backend engineers integrating payments into any NestJS module (donations, commerce, SaaS, etc).

---

## Quick Navigation

| Section | Purpose |
|--------|---------|
| [1. Concept & Capabilities](#1-concept--capabilities) | Why the platform exists, core ideas |
| [2. Folder Map](#2-folder-map) | Where things live inside `src/payment/` |
| [3. Setup Checklist](#3-setup-checklist) | Everything you must configure before going live |
| [4. PaymentService API](#4-paymentservice-api) | Core methods, inputs, outputs |
| [5. Provider Playbook](#5-provider-playbook) | Register/activate/switch providers |
| [6. Feature Recipes](#6-feature-recipes) | How to use the module in common scenarios |
| [7. Reconciliation Summary](#7-reconciliation-summary) | Cron + manual verification overview |
| [8. Testing & Troubleshooting](#8-testing--troubleshooting) | Testing tips, common issues |
| [Appendix A](#appendix-a-provider-handbooks) | Deep dives for each provider (separate docs) |
| [Appendix B](#appendix-b-scenario-examples) | Ready-to-use sample services/controllers |

> **New Docs Created:**  
> • `myfatoorah.md` – complete MyFatoorah handbook  
> • `paymob.md` – PayMob handbook  
> • `stripe.md` – Stripe handbook  
> • `examples.md` – end-to-end scenario catalogue  
> All files live in `src/payment/common/docs/`.

---

## 1. Concept & Capabilities

The payment module is a **provider-agnostic platform** that exposes one façade (`PaymentService`) and hides the specifics of MyFatoorah, PayMob, Stripe, or any future gateway. It follows the Strategy Pattern and dependency injection so that:

* Each provider is optional and isolated.
* Payment methods are returned straight from the provider response (no hard-coded enums).
* The same API can be reused in donations, retail, pharmacies, or any NestJS bounded context.

### Highlights

| Feature | Details |
|---------|---------|
| Multi-provider | Register unlimited providers; switch per request |
| Health-aware | Built-in `healthCheck()` for dashboards and fallbacks |
| Reusable payloads | Generic `PaymentPayload` works for donations, orders, subscriptions |
| Provider-specific methods | Every provider exposes its payment methods without affecting others |
| Memory/perf | HTTP keep-alive, `OnModuleDestroy` cleanup, provider cap to avoid leaks |
| Reconciliation | Cron + manual APIs mark stale payments as failed |

---

## 2. Folder Map

```
src/payment/
├── payment.module.ts           // wires providers + shared services
├── payment.service.ts          // main façade (createPayment, status, methods, health…)
├── payment-methods.controller.ts // public API for listing methods/health
├── webhook.controller.ts       // normalized webhook endpoints
├── providers/                  // each provider implements IPaymentProvider
│    ├── myfatoora.provider.ts
│    ├── paymob.provider.ts
│    └── stripe.provider.ts
├── common/
│    ├── interfaces/            // shared DTOs & interfaces
│    ├── services/              // helpers (currency, logging…)
│    └── docs/                  // THIS README + provider docs + examples
└── common/cron/
     ├── payment-reconciliation.cron.ts
     └── payment-reconciliation.cron.controller.ts
```

---

## 3. Setup Checklist

| Step | Action |
|------|--------|
| 1 | Import `PaymentModule` in the module that needs payments (often `AppModule`). |
| 2 | Populate `.env` with the providers you plan to enable. No env → provider stays inactive. |
| 3 | (Optional) Set `PAYMENT_PROVIDER=myfatoorah|stripe|paymob` to choose the default provider. |
| 4 | Expose `PaymentMethodsController` routes in your API (already part of `PaymentModule`). |
| 5 | Configure webhook URLs for every provider you enable. |
| 6 | Run `npm run build` to ensure no config-related errors (missing callback URLs, etc.). |

> Detailed env keys + step-by-step guides live in the provider handbooks (`myfatoorah.md`, `paymob.md`, `stripe.md`).

---

## 4. PaymentService API

| Method | Description | Notes |
|--------|-------------|-------|
| `createPayment(payload, provider?)` | Creates invoice / payment intent / intention | `payload.paymentMethodId` is forwarded verbatim (number or string). |
| `getPaymentStatus(transactionId, provider?)` | Normalized status (`paid`, `pending`, `failed`) | Applies provider-agnostic expiry check. |
| `getAvailablePaymentMethods(amount, currency, provider?)` | Returns provider’s native payment methods + service charge | Always queries the provider live unless it is unhealthy (then falls back to static list). |
| `handleWebhook(rawData, provider)` | Normalizes webhook payloads to `PaymentWebhookEvent` | Use inside webhook controllers/services. |
| `healthCheck(provider?)` | Checks credential validity + reachability | Accepts single provider or returns array. |
| `registerProvider(type, instance)` / `setActiveProvider(type)` | (Advanced) runtime swapping | Typically only used inside modules or integration tests. |

All payload interfaces live in `common/interfaces/payment-provider.interface.ts` & `payment-service.interface.ts`.

---

## 5. Provider Playbook

### 5.1 Lifecycle

1. **Registration** happens in `payment.module.ts`. Each provider factory tries to instantiate the provider only if required env variables exist.
2. **Activation** – `PaymentService` automatically selects the first configured provider or the one specified via `PAYMENT_PROVIDER`. You can override per request by passing `providerType`.
3. **Isolation** – Providers never share state; each one keeps its own HTTP client, metadata, payment methods, and error handling. Removing one provider has zero impact on the others.

### 5.2 Adding A Provider

1. Create `providers/my-new-gateway.provider.ts` implementing `IPaymentProvider`.
2. Register it inside `PaymentModule` (providers array + optional exports).
3. Extend `.env.example` with its config keys.
4. Document it (follow the template used in `myfatoorah.md`, etc.).

---

## 6. Feature Recipes

This section covers the *how* of using the payment façade in different product verticals. For complete services/controllers, open `examples.md`.

### 6.1 One provider for the whole product

```typescript
const payment = await this.paymentService.createPayment(payload); // uses active provider
```

Set `PAYMENT_PROVIDER` to the gateway you want (e.g., `stripe`). Frontends call `GET /payment-methods/available` with no `provider` parameter.

### 6.2 Provider per request (user chooses)

```typescript
const payment = await this.paymentService.createPayment(payload, userChoice); // 'myfatoorah' | 'stripe' | 'paymob'
```

Frontends should call `GET /payment-methods/available?provider=${userChoice}` to fetch the matching payment methods/services charges.

### 6.3 Provider fallback

Call `paymentService.healthCheck()` first, then try providers in priority order (see `examples.md` → Multi-provider fallback).

### 6.4 Handling payment methods

* All payment methods come directly from the provider response (IDs, codes, service charges, min/max limits, image URLs).
* When the frontend posts a payment method ID (number or string), we simply forward it to the provider. No mapping layer means Apple Pay on Stripe won’t collide with Apple Pay on MyFatoorah.
* `CreateDonationDto` now accepts numeric or string `paymentMethod` and normalizes to string automatically.

### 6.5 Webhooks

* `WebhookController` exposes `/webhooks/myfatoora`, `/webhooks/paymob`, `/webhooks/stripe`.
* It sends the raw payload to `DonationsService.handlePaymentWebhook([] , event)` (or your own service). Passing an empty array means “accept whatever payment method the provider used”.
* Each provider implements `handleWebhook` and `validateWebhook` (when possible) to keep verification centralized.

### 6.6 Payment Reconciliation

* Automatic cron every 3 minutes.
* Manual endpoints `/payment-reconciliation/reconcile`, `/payment-reconciliation/stats`.
* Provider detection is automatic via raw metadata. If the provider can’t be determined but the payment exceeded the timeout, it is marked as failed with a reason.

---

## 7. Reconciliation Summary

* File: `common/cron/payment-reconciliation.cron.ts`.
* Timeout: default 15 minutes (configurable).
* Behavior:
  1. Query pending payments older than timeout.
  2. Detect provider via `rawResponse` or `transactionId`.
  3. Call `PaymentService.getPaymentStatus`.
  4. Mark as `failed` if still pending, or update to the returned status.
* Manual operations available via `PaymentReconciliationController`.
* For detailed guide (API payloads, logging), see `examples.md` → “Reconciliation & Admin Monitoring”.

---

## 8. Testing & Troubleshooting

### 8.1 Local Testing Tips

1. Use provider sandboxes (MyFatoorah test account, Stripe/PayMob test keys).
2. Run `npm run test payment` to execute provider unit tests (if present).
3. Mock providers by registering fake IPaymentProvider implementations when unit testing modules that consume `PaymentService`.

### 8.2 Common Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Provider is not configured` | Missing env vars or incorrect config service injection | Ensure `.env` has the keys listed in the provider docs. |
| `401 Unauthorized` | Wrong API key or token formatting | Remove quotes/spaces, double-check sandbox vs production keys. |
| `paymentMethod must be a string` | Frontend sending numeric ID | Already fixed by DTO transform (numbers auto-convert). Ensure other DTOs follow the same pattern. |
| Webhook not firing | Provider cannot reach your local server | Use tunneling (ngrok) or deploy webhook endpoint publicly. |
| Payment stuck pending | Webhook disabled or user abandoned payment | Use reconciliation cron and `getPaymentStatus` manually. |

### 8.3 Debugging Tricks

```typescript
this.logger.debug('Payload →', payload);
const methods = await this.paymentService.getAvailablePaymentMethods(amount, currency, 'myfatoorah');
console.table(methods.paymentMethods);
```

Check provider health:

```typescript
const health = await this.paymentService.healthCheck();
console.log(JSON.stringify(health, null, 2));
```

---

## Appendix A: Provider Handbooks

Each provider has a dedicated markdown file with:
* Capabilities & supported regions.
* Required/optional environment variables.
* CLI-friendly setup steps.
* Full payment flows (sequence diagrams, code).
* Troubleshooting matrix per provider.

| File | Description |
|------|-------------|
| `myfatoorah.md` | KNET/Apple Pay/Google Pay/Benefit guide, callback setup, webhook payload samples. |
| `paymob.md` | Intention API vs legacy API, cross-country base URLs, wallet/card flows. |
| `stripe.md` | PaymentIntent + Checkout flows, Apple/Google Pay enablement, webhook verification. |

---

## Appendix B: Scenario Examples

All example suites live in `examples.md`. Contents:

1. Donations (Stripe + MyFatoorah) – service + controller + webhook integration.
2. Subscription billing (PayMob) – intention creation and renewal logic.
3. E-commerce orders – MyFatoorah full flow including verification and fallback.
4. Multi-provider fallback service – health-aware provider ordering.
5. Admin dashboards – health monitor endpoints.
6. Reconciliation – manual API + cron usage.

Each scenario includes:
* Service code with logging and error handling.
* REST controller showcasing API routes.
* Frontend considerations (what query params to pass to `/payment-methods/available`).

---

### Need help?

* For provider-specific questions, jump to the relevant handbook.
* For integration strategies, copy from `examples.md`.
* For bugs, inspect provider health and logs first, then open an issue or contact the backend platform team.

**Last updated:** February 2025  
**Maintainers:** Payment Platform Team (NestJS core squad)

## Provider Configuration

### MyFatoorah Configuration

#### Environment Variables

```env
MYFATOORAH_API_KEY=your_api_key_here
MYFATOORAH_API_URL=https://apitest.myfatoorah.com
MYFATOORAH_CALLBACK_URL=https://yourdomain.com/payment/success
MYFATOORAH_ERROR_URL=https://yourdomain.com/payment/error
MYFATOORAH_INVOICE_TTL_MINUTES=60
MYFATOORAH_TIMEZONE=Asia/Kuwait
MYFATOORAH_TTL_SKEW_SECONDS=30
```

#### Programmatic Configuration

```typescript
import { MyFatooraService } from './payment/myfatoora.service';

const myFatooraService = new MyFatooraService({
  apiKey: 'your_api_key',
  apiUrl: 'https://apitest.myfatoorah.com',
  callbackUrl: 'https://yourdomain.com/payment/success',
  errorUrl: 'https://yourdomain.com/payment/error',
  invoiceTtlMinutes: 60,
  timezone: 'Asia/Kuwait',
  ttlSkewSeconds: 30,
});
```

#### Required Configuration

- `apiKey`: MyFatoorah API key (required)
- `callbackUrl`: URL for successful payments (required for payment creation)
- `errorUrl`: URL for failed payments (required for payment creation)

#### Optional Configuration

- `apiUrl`: API base URL (default: `https://apitest.myfatoorah.com/v2/`)
- `invoiceTtlMinutes`: Invoice expiration time in minutes (default: 60)
- `timezone`: Timezone for invoice expiry (default: `Asia/Kuwait`)
- `ttlSkewSeconds`: Buffer time in seconds (default: 30)

### PayMob Configuration

#### Environment Variables

```env
# Intention API (Recommended)
PAYMOB_SECRET_KEY=egy_sk_test_...
PAYMOB_COUNTRY=EGYPT
PAYMOB_INTENTION_BASE_URL=https://accept.paymob.com/v1/intention
PAYMOB_INTEGRATION_ID=123456
PAYMOB_IFRAME_ID=978747
PAYMOB_CALLBACK_URL=https://yourdomain.com/payment/callback

# Legacy API (Alternative)
PAYMOB_API_KEY=your_base64_encoded_key
PAYMOB_BASE_URL=https://accept.paymob.com/api
PAYMOB_INTEGRATION_ID=123456
PAYMOB_CALLBACK_URL=https://yourdomain.com/payment/callback
```

#### Supported Countries

PayMob supports different countries with different API endpoints:

- **EGYPT**: `https://accept.paymob.com` (Default currency: EGP)
- **SAUDI_ARABIA**: `https://ksa.paymob.com` (Default currency: SAR)
- **UAE**: `https://uae.paymob.com` (Default currency: AED)
- **OMAN**: `https://oman.paymob.com` (Default currency: OMR)
- **PAKISTAN**: `https://pakistan.paymob.com` (Default currency: PKR)

#### Programmatic Configuration

```typescript
import { PayMobService } from './payment/paymob.service';

// Intention API (Recommended)
const payMobService = new PayMobService({
  secretKey: 'egy_sk_test_...',
  country: 'EGYPT',
  intentionApiUrl: 'https://accept.paymob.com/v1/intention',
  integrationId: 123456,
  iframeId: 978747,
  callbackUrl: 'https://yourdomain.com/payment/callback',
  defaultCurrency: 'EGP',
});

// Legacy API (Alternative)
const payMobService = new PayMobService({
  apiKey: 'your_base64_encoded_key',
  baseUrl: 'https://accept.paymob.com/api',
  integrationId: 123456,
  callbackUrl: 'https://yourdomain.com/payment/callback',
});
```

#### Required Configuration

**For Intention API (Recommended):**
- `secretKey`: PayMob secret key (Token format: `egy_sk_test_...` or `ksa_sk_test_...`)
- `country`: Country code (e.g., `EGYPT`, `SAUDI_ARABIA`, `UAE`)
- `callbackUrl`: Callback URL for payments

**For Legacy API:**
- `apiKey`: PayMob API key (Base64 encoded)
- `integrationId`: Integration ID for card payments
- `callbackUrl`: Callback URL for payments

#### Optional Configuration

- `iframeId`: Iframe ID for iframe-based payments
- `notificationUrl`: Webhook notification URL
- `defaultCurrency`: Default currency code (auto-set based on country)
- `fallbackPhone`: Fallback phone number for billing data

### Stripe Configuration

#### Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_API_VERSION=2023-10-16
STRIPE_API_URL=https://api.stripe.com/v1
STRIPE_SUCCESS_URL=https://yourdomain.com/payment/success
STRIPE_CANCEL_URL=https://yourdomain.com/payment/cancel
```

#### Programmatic Configuration

```typescript
import { StripeService } from './payment/stripe.service';

const stripeService = new StripeService({
  secretKey: 'sk_test_...',
  publishableKey: 'pk_test_...',
  webhookSecret: 'whsec_...',
  apiVersion: '2023-10-16',
  apiUrl: 'https://api.stripe.com/v1',
  successUrl: 'https://yourdomain.com/payment/success',
  cancelUrl: 'https://yourdomain.com/payment/cancel',
});
```

#### Required Configuration

- `secretKey`: Stripe secret key (required)

#### Optional Configuration

- `publishableKey`: Stripe publishable key (for client-side integration)
- `webhookSecret`: Webhook secret for signature validation
- `apiVersion`: Stripe API version (default: `2023-10-16`)
- `apiUrl`: Stripe API base URL (default: `https://api.stripe.com/v1`)
- `successUrl`: Success redirect URL
- `cancelUrl`: Cancel redirect URL

---

## Usage Guide

### Using PaymentService

`PaymentService` is the main interface for payment operations. It automatically manages all registered providers.

#### Inject PaymentService

```typescript
import { Injectable } from '@nestjs/common';
import { PaymentService } from './payment/payment.service';

@Injectable()
export class YourService {
  constructor(private readonly paymentService: PaymentService) {}
}
```

#### Create Payment

```typescript
// Create payment with active provider (default: MyFatoorah)
const result = await this.paymentService.createPayment({
  amount: 100,
  currency: 'KWD',
  referenceId: 'order-123', // Generic reference ID (orderId, donationId, etc.)
  description: 'Payment for order #123',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  customerMobile: '+96512345678',
});

// Use specific provider
const result = await this.paymentService.createPayment(
  {
    amount: 100,
    currency: 'KWD',
    referenceId: 'order-123',
    description: 'Payment for order #123',
    customerEmail: 'customer@example.com',
  },
  'stripe', // Specify provider
);
```

#### Get Payment Status

```typescript
// Get payment status
const status = await this.paymentService.getPaymentStatus(
  'invoice-id-123',
  'myfatoorah', // Optional: specify provider
);
```

#### Get Available Payment Methods

```typescript
// Get available payment methods
const methods = await this.paymentService.getAvailablePaymentMethods(
  100, // Amount
  'KWD', // Currency
  'myfatoorah', // Optional: specify provider
);
```

#### Health Check

```typescript
// Check health of all providers
const health = await this.paymentService.healthCheck();

// Check health of specific provider
const health = await this.paymentService.healthCheck('myfatoorah');
```

### Using Individual Providers

You can also use providers directly if you need provider-specific features.

#### MyFatoorah Service

```typescript
import { MyFatooraService } from './payment/myfatoora.service';

@Injectable()
export class YourService {
  constructor(private readonly myFatooraService: MyFatooraService) {}

  async createPayment() {
    const result = await this.myFatooraService.createPayment({
      amount: 100,
      currency: 'KWD',
      referenceId: 'order-123',
      description: 'Payment for order #123',
      customerEmail: 'customer@example.com',
      paymentMethodId: 1, // KNET
    });
  }
}
```

#### PayMob Service

```typescript
import { PayMobService } from './payment/paymob.service';

@Injectable()
export class YourService {
  constructor(private readonly payMobService: PayMobService) {}

  async createPayment() {
    const result = await this.payMobService.createPayment({
      amount: 100,
      currency: 'EGP',
      referenceId: 'order-123',
      description: 'Payment for order #123',
      customerEmail: 'customer@example.com',
      paymentMethodId: 'card', // or integration ID: 12
    });
  }
}
```

#### Stripe Service

```typescript
import { StripeService } from './payment/stripe.service';

@Injectable()
export class YourService {
  constructor(private readonly stripeService: StripeService) {}

  async createPayment() {
    const result = await this.stripeService.createPayment({
      amount: 100,
      currency: 'USD',
      referenceId: 'order-123',
      description: 'Payment for order #123',
      customerEmail: 'customer@example.com',
      paymentMethodId: 'card', // or 'apple_pay', 'google_pay'
    });
  }
}
```

### Payment Methods

#### MyFatoorah Payment Methods

MyFatoorah supports the following payment methods:

| ID | Code | Name (EN) | Name (AR) | Direct Payment |
|----|------|-----------|-----------|----------------|
| 1 | KNET | KNET | كي نت | No |
| 2 | VISA | VISA/MASTER | فيزا / ماستر | No |
| 3 | AMEX | AMEX | اميكس | No |
| 4 | BENEFIT | Benefit | بنفت | No |
| 5 | MADA | MADA | مدى | No |
| 6 | UAE_DEBIT | UAE Debit Cards | كروت الدفع المدينة (الامارات) | No |
| 7 | QATAR_DEBIT | Qatar Debit Cards | كروت الدفع المدينة (قطر) | No |
| 8 | APPLE_PAY | Apple Pay | ابل باي | Yes |
| 9 | GOOGLE_PAY | Google Pay | جوجل باي | Yes |
| 10 | STC_PAY | STC Pay | STC Pay | No |
| 11 | OMAN_NET | Oman Net | عمان نت | No |
| 12 | MOBILE_WALLET_EGYPT | Mobile Wallet (Egypt) | محفظة إلكترونية (مصر) | No |
| 13 | MEEZA | Meeza | ميزة | No |

#### Using Payment Methods

```typescript
// Create payment with specific payment method
const result = await this.paymentService.createPayment({
  amount: 100,
  currency: 'KWD',
  referenceId: 'order-123',
  paymentMethodId: 1, // KNET for MyFatoorah
  // or
  paymentMethodId: 'card', // Card for PayMob/Stripe
});
```

#### Get Available Payment Methods

```typescript
// Get available payment methods with service charges
const methods = await this.paymentService.getAvailablePaymentMethods(
  100, // Amount
  'KWD', // Currency
);

// Response structure
{
  success: true,
  paymentMethods: [
    {
      id: 1,
      code: 'KNET',
      nameEn: 'KNET',
      nameAr: 'كي نت',
      isDirectPayment: false,
      serviceCharge: 0.5,
      totalAmount: 100.5,
      currency: 'KWD',
      minLimit: 1,
      maxLimit: 1000,
    },
    // ... more methods
  ],
  invoiceAmount: 100,
  currency: 'KWD',
  timestamp: '2025-01-01T00:00:00.000Z',
}
```

---

## Provider-Specific Guides

### MyFatoorah Guide

#### Supported Features

- ✅ All MyFatoorah payment methods
- ✅ Real-time payment method availability
- ✅ Service charge calculation
- ✅ Invoice creation with TTL
- ✅ Payment status tracking
- ✅ Webhook handling
- ✅ Health check

#### Payment Flow

1. **Initiate Payment**: Get available payment methods with service charges
2. **Create Invoice**: Create invoice with selected payment method
3. **Redirect User**: Redirect user to payment URL
4. **Webhook/Callback**: Receive payment status update
5. **Verify Payment**: Verify payment status if needed

#### Example: Complete Payment Flow

```typescript
// Step 1: Get available payment methods
const methods = await this.myFatooraService.getAvailablePaymentMethods(
  100,
  'KWD',
);

// Step 2: Create payment with selected method
const payment = await this.myFatooraService.createPayment({
  amount: 100,
  currency: 'KWD',
  referenceId: 'order-123',
  description: 'Payment for order #123',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  customerMobile: '+96512345678',
  paymentMethodId: 1, // KNET
});

// Step 3: Redirect user to payment.url
// In your controller:
return { redirectUrl: payment.url };

// Step 4: Handle webhook (automatic)
// Webhook is handled by WebhookController

// Step 5: Verify payment status (if needed)
const status = await this.myFatooraService.getPaymentStatus(
  payment.id,
  'InvoiceId',
);
```

#### Payment Status Keys

MyFatoorah supports different key types for status lookup:

- `InvoiceId`: Invoice ID (recommended)
- `PaymentId`: Payment ID
- `CustomerReference`: Customer reference

```typescript
// Get status by Invoice ID
const status = await this.myFatooraService.getPaymentStatus(
  'invoice-id-123',
  'InvoiceId',
);

// Get status by Payment ID
const status = await this.myFatooraService.getPaymentStatus(
  'payment-id-123',
  'PaymentId',
);
```

### PayMob Guide

#### Supported Features

- ✅ Intention API (Recommended)
- ✅ Legacy API (Alternative)
- ✅ Multiple countries support
- ✅ Card payments
- ✅ Wallet payments
- ✅ Webhook handling
- ✅ Health check

#### Payment Flow

1. **Create Intention**: Create payment intention with PayMob
2. **Get Payment Key**: Receive payment key/token
3. **Redirect User**: Redirect user to payment URL (iframe or redirect)
4. **Webhook/Callback**: Receive payment status update
5. **Verify Payment**: Verify payment status if needed

#### Example: Complete Payment Flow (Intention API)

```typescript
// Step 1: Create payment with Intention API
const payment = await this.payMobService.createPayment({
  amount: 100,
  currency: 'EGP',
  referenceId: 'order-123',
  description: 'Payment for order #123',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  customerMobile: '+201234567890',
  paymentMethodId: 'card', // or integration ID: 12
});

// Step 2: Redirect user to payment.url
// In your controller:
return { redirectUrl: payment.url };

// Step 3: Handle webhook (automatic)
// Webhook is handled by WebhookController

// Step 4: Verify payment status (if needed)
const status = await this.payMobService.getPaymentStatus(payment.id);
```

#### Payment Methods

PayMob supports different payment methods based on integration:

- **Card**: Credit/Debit cards (Integration ID required)
- **Wallet**: Mobile wallets (Vodafone Cash, Etisalat Cash, etc.)
- **Integration IDs**: Numeric IDs for specific payment methods

```typescript
// Use card payment
const payment = await this.payMobService.createPayment({
  // ... other fields
  paymentMethodId: 'card', // or integration ID: 12
});

// Use specific integration
const payment = await this.payMobService.createPayment({
  // ... other fields
  paymentMethodId: 12, // Integration ID
});
```

### Stripe Guide

#### Supported Features

- ✅ Payment Intents
- ✅ Checkout Sessions
- ✅ Card payments
- ✅ Apple Pay
- ✅ Google Pay
- ✅ Webhook handling
- ✅ Health check

#### Payment Flow

1. **Create Payment Intent**: Create payment intent with Stripe
2. **Get Client Secret**: Receive client secret or checkout URL
3. **Redirect User**: Redirect user to payment page or use client secret
4. **Webhook**: Receive payment status update
5. **Verify Payment**: Verify payment status if needed

#### Example: Complete Payment Flow

```typescript
// Step 1: Create payment intent
const payment = await this.stripeService.createPayment({
  amount: 100,
  currency: 'USD',
  referenceId: 'order-123',
  description: 'Payment for order #123',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  paymentMethodId: 'card', // or 'apple_pay', 'google_pay'
});

// Step 2: Use payment.url (client_secret or checkout URL)
// For client_secret: Use Stripe.js on frontend
// For checkout URL: Redirect user

// Step 3: Handle webhook (automatic)
// Webhook is handled by WebhookController

// Step 4: Verify payment status (if needed)
const status = await this.stripeService.getPaymentStatus(payment.id);
```

#### Payment Methods

Stripe supports:

- **Card**: Credit/Debit cards
- **Apple Pay**: Apple Pay (direct payment)
- **Google Pay**: Google Pay (direct payment)

```typescript
// Use card payment
const payment = await this.stripeService.createPayment({
  // ... other fields
  paymentMethodId: 'card',
});

// Use Apple Pay
const payment = await this.stripeService.createPayment({
  // ... other fields
  paymentMethodId: 'apple_pay',
});

// Use Google Pay
const payment = await this.stripeService.createPayment({
  // ... other fields
  paymentMethodId: 'google_pay',
});
```

---

## API Reference

### PaymentService

#### Methods

##### `createPayment(payload, provider?)`

Create a payment with the specified provider.

**Parameters:**
- `payload`: `PaymentPayload & { paymentMethodId?: string | number }`
  - `amount`: number (required)
  - `currency`: string (required)
  - `referenceId`: string (required) - Generic reference ID (orderId, donationId, etc.)
  - `description`: string (optional)
  - `customerEmail`: string (optional)
  - `customerName`: string (optional)
  - `customerMobile`: string (optional)
  - `metadata`: Record<string, any> (optional)
  - `paymentMethodId`: string | number (optional) - Provider-specific payment method ID
- `provider`: `PaymentProviderType` (optional) - Provider to use. If not specified, uses active provider.

**Returns:** `Promise<PaymentResult>`

```typescript
interface PaymentResult {
  id: string; // Transaction/Invoice ID
  url: string; // Payment URL or client_secret
  status: 'pending' | 'paid' | 'failed' | 'succeeded' | 'canceled';
  rawResponse?: any; // Raw response from provider
}
```

##### `getPaymentStatus(transactionId, provider?)`

Get payment status by transaction ID.

**Parameters:**
- `transactionId`: string (required) - Transaction/Invoice ID
- `provider`: `PaymentProviderType` (optional) - Provider to use

**Returns:** `Promise<PaymentStatusResult>`

```typescript
interface PaymentStatusResult {
  outcome: 'paid' | 'failed' | 'pending';
  transactionId: string;
  paymentId?: string;
  amount?: number;
  currency?: string;
  raw?: any;
}
```

##### `getAvailablePaymentMethods(invoiceAmount, currencyIso, provider?)`

Get available payment methods for a given amount and currency.

**Parameters:**
- `invoiceAmount`: number (required)
- `currencyIso`: string (required)
- `provider`: `PaymentProviderType` (optional) - Provider to use

**Returns:** `Promise<AvailablePaymentMethodsResponse>`

##### `healthCheck(provider?)`

Check health status of payment providers.

**Parameters:**
- `provider`: `PaymentProviderType` (optional) - Provider to check. If not specified, checks all providers.

**Returns:** `Promise<ProviderHealthCheckResult | ProviderHealthCheckResult[]>`

### IPaymentProvider Interface

All providers implement this interface:

```typescript
interface IPaymentProvider {
  readonly providerName: string;
  readonly providerVersion?: string;
  
  isConfigured(): boolean;
  createPayment(payload: PaymentPayload & { paymentMethodId?: string | number }): Promise<PaymentResult>;
  getPaymentStatus(transactionId: string): Promise<PaymentStatusResult>;
  getAvailablePaymentMethods(invoiceAmount: number, currencyIso: string): Promise<AvailablePaymentMethodsResponse>;
  handleWebhook(webhookData: any): Promise<PaymentWebhookEvent>;
  validateWebhook?(webhookData: any): Promise<boolean>;
  healthCheck?(): Promise<ProviderHealthCheckResult>;
}
```

---

## Examples

### Complete Project Examples

This section provides complete, working examples for each payment provider using `PaymentService`. Each example includes:
- Service implementation
- Controller endpoints
- Error handling
- Payment status verification
- Webhook handling

---

### Example 1: MyFatoorah - Complete E-commerce Integration

A complete example showing how to integrate MyFatoorah payments in an e-commerce application.

#### 1. Service Implementation

```typescript
// src/orders/order-payment.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';
import { OrderRepository } from './order.repository';

@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly orderRepository: OrderRepository,
  ) {}

  /**
   * Create payment for an order using MyFatoorah
   */
  async createOrderPayment(orderId: string) {
    // Get order details
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new BadRequestException(`Order ${orderId} not found`);
    }

    if (order.status !== 'pending_payment') {
      throw new BadRequestException('Order is not in pending payment status');
    }

    try {
      // Step 1: Get available payment methods
      const methods = await this.paymentService.getAvailablePaymentMethods(
        order.totalAmount,
        order.currency,
        'myfatoorah',
      );

      this.logger.log(`Available payment methods: ${methods.paymentMethods.length}`);

      // Step 2: Create payment with MyFatoorah
      const payment = await this.paymentService.createPayment(
        {
          amount: order.totalAmount,
          currency: order.currency,
          referenceId: orderId,
          description: `Payment for order #${order.orderNumber}`,
          customerEmail: order.customerEmail,
          customerName: order.customerName,
          customerMobile: order.customerPhone,
          metadata: {
            orderNumber: order.orderNumber,
            orderType: order.type,
          },
        },
        'myfatoorah', // Use MyFatoorah provider
      );

      // Step 3: Save payment record
      await this.orderRepository.update(orderId, {
        paymentId: payment.id,
        paymentUrl: payment.url,
        paymentStatus: payment.status,
      });

      this.logger.log(`Payment created for order ${orderId}: ${payment.id}`);

      return {
        success: true,
        paymentId: payment.id,
        paymentUrl: payment.url,
        invoiceId: payment.id,
        availableMethods: methods.paymentMethods,
      };
    } catch (error) {
      this.logger.error(`Failed to create payment for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Verify payment status after callback
   */
  async verifyOrderPayment(orderId: string, invoiceId: string) {
    try {
      // Get payment status from MyFatoorah
      const status = await this.paymentService.getPaymentStatus(
        invoiceId,
        'myfatoorah',
      );

      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) {
        throw new BadRequestException(`Order ${orderId} not found`);
      }

      // Update order based on payment status
      if (status.outcome === 'paid') {
        await this.orderRepository.update(orderId, {
          status: 'paid',
          paymentStatus: 'paid',
          paidAt: new Date(),
        });
        this.logger.log(`Order ${orderId} marked as paid`);
        return { success: true, status: 'paid', order };
      } else if (status.outcome === 'failed') {
        await this.orderRepository.update(orderId, {
          status: 'payment_failed',
          paymentStatus: 'failed',
        });
        this.logger.warn(`Order ${orderId} payment failed`);
        return { success: false, status: 'failed', order };
      }

      return { success: false, status: 'pending', order };
    } catch (error) {
      this.logger.error(`Failed to verify payment for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Handle MyFatoorah webhook
   */
  async handleMyFatoorahWebhook(webhookData: any) {
    try {
      // Process webhook through PaymentService
      const event = await this.paymentService.handleWebhook(
        webhookData,
        'myfatoorah',
      );

      this.logger.log(`Webhook received: ${event.eventType} for ${event.transactionId}`);

      // Find order by referenceId (orderId)
      const order = await this.orderRepository.findOne({
        where: { id: event.transactionId }, // Assuming transactionId contains orderId
      });

      if (!order) {
        this.logger.warn(`Order not found for transaction: ${event.transactionId}`);
        return { received: true, processed: false };
      }

      // Update order based on webhook status
      if (event.status === 'paid') {
        await this.orderRepository.update(order.id, {
          status: 'paid',
          paymentStatus: 'paid',
          paidAt: new Date(),
        });
        this.logger.log(`Order ${order.id} updated to paid via webhook`);
      } else if (event.status === 'failed') {
        await this.orderRepository.update(order.id, {
          status: 'payment_failed',
          paymentStatus: 'failed',
        });
      }

      return { received: true, processed: true, orderId: order.id };
    } catch (error) {
      this.logger.error('Webhook processing error:', error);
      throw error;
    }
  }
}
```

#### 2. Controller Implementation

```typescript
// src/orders/order-payment.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrderPaymentService } from './order-payment.service';

@Controller('orders')
export class OrderPaymentController {
  private readonly logger = new Logger(OrderPaymentController.name);

  constructor(private readonly orderPaymentService: OrderPaymentService) {}

  /**
   * Create payment for an order
   * POST /orders/:orderId/payment
   */
  @Post(':orderId/payment')
  async createPayment(@Param('orderId') orderId: string) {
    try {
      const result = await this.orderPaymentService.createOrderPayment(orderId);
      return {
        success: true,
        message: 'Payment created successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Payment creation failed for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Payment callback (success/error)
   * GET /orders/:orderId/payment/callback
   */
  @Get(':orderId/payment/callback')
  async paymentCallback(
    @Param('orderId') orderId: string,
    @Query('paymentId') paymentId: string,
    @Query('Id') invoiceId: string,
  ) {
    try {
      // Verify payment status
      const result = await this.orderPaymentService.verifyOrderPayment(
        orderId,
        invoiceId || paymentId,
      );

      if (result.status === 'paid') {
        // Redirect to success page
        return {
          success: true,
          redirectUrl: `/orders/${orderId}/success`,
          message: 'Payment successful',
        };
      } else {
        // Redirect to failure page
        return {
          success: false,
          redirectUrl: `/orders/${orderId}/failed`,
          message: 'Payment failed',
        };
      }
    } catch (error) {
      this.logger.error(`Payment callback error for order ${orderId}:`, error);
      return {
        success: false,
        redirectUrl: `/orders/${orderId}/error`,
        message: 'Payment verification failed',
      };
    }
  }

  /**
   * MyFatoorah webhook endpoint
   * POST /orders/payment/webhook/myfatoorah
   */
  @Post('payment/webhook/myfatoorah')
  async handleWebhook(@Body() webhookData: any) {
    try {
      const result = await this.orderPaymentService.handleMyFatoorahWebhook(
        webhookData,
      );
      return { received: true, ...result };
    } catch (error) {
      this.logger.error('Webhook handling error:', error);
      // Return 200 to prevent webhook retries
      return { received: true, error: 'Processing failed' };
    }
  }

  /**
   * Check payment status
   * GET /orders/:orderId/payment/status
   */
  @Get(':orderId/payment/status')
  async getPaymentStatus(@Param('orderId') orderId: string) {
    try {
      const order = await this.orderPaymentService.getOrder(orderId);
      if (!order.paymentId) {
        throw new BadRequestException('No payment found for this order');
      }

      const status = await this.paymentService.getPaymentStatus(
        order.paymentId,
        'myfatoorah',
      );

      return {
        success: true,
        status: status.outcome,
        paymentId: status.transactionId,
        amount: status.amount,
        currency: status.currency,
      };
    } catch (error) {
      this.logger.error(`Status check failed for order ${orderId}:`, error);
      throw error;
    }
  }
}
```

---

### Example 2: PayMob - Complete Subscription Payment Integration

A complete example showing how to integrate PayMob payments for subscription billing.

#### 1. Service Implementation

```typescript
// src/subscriptions/subscription-payment.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';
import { SubscriptionRepository } from './subscription.repository';

@Injectable()
export class SubscriptionPaymentService {
  private readonly logger = new Logger(SubscriptionPaymentService.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}

  /**
   * Create payment for subscription using PayMob
   */
  async createSubscriptionPayment(subscriptionId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new BadRequestException(`Subscription ${subscriptionId} not found`);
    }

    try {
      // Step 1: Get available payment methods from PayMob
      const methods = await this.paymentService.getAvailablePaymentMethods(
        subscription.amount,
        subscription.currency,
        'paymob',
      );

      this.logger.log(
        `PayMob payment methods available: ${methods.paymentMethods.length}`,
      );

      // Step 2: Create payment with PayMob (Intention API)
      const payment = await this.paymentService.createPayment(
        {
          amount: subscription.amount,
          currency: subscription.currency,
          referenceId: subscriptionId,
          description: `Subscription payment for ${subscription.planName}`,
          customerEmail: subscription.userEmail,
          customerName: subscription.userName,
          customerMobile: subscription.userPhone,
          paymentMethodId: 'card', // or specific integration ID
          metadata: {
            subscriptionId: subscription.id,
            planId: subscription.planId,
            billingCycle: subscription.billingCycle,
          },
        },
        'paymob', // Use PayMob provider
      );

      // Step 3: Save payment record
      await this.subscriptionRepository.update(subscriptionId, {
        paymentId: payment.id,
        paymentUrl: payment.url,
        paymentStatus: payment.status,
        lastPaymentAttempt: new Date(),
      });

      this.logger.log(
        `PayMob payment created for subscription ${subscriptionId}: ${payment.id}`,
      );

      return {
        success: true,
        paymentId: payment.id,
        paymentUrl: payment.url,
        intentionId: payment.id,
        availableMethods: methods.paymentMethods,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create PayMob payment for subscription ${subscriptionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Verify payment status after PayMob callback
   */
  async verifySubscriptionPayment(
    subscriptionId: string,
    transactionId: string,
  ) {
    try {
      // Get payment status from PayMob
      const status = await this.paymentService.getPaymentStatus(
        transactionId,
        'paymob',
      );

      const subscription = await this.subscriptionRepository.findOne({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        throw new BadRequestException(
          `Subscription ${subscriptionId} not found`,
        );
      }

      // Update subscription based on payment status
      if (status.outcome === 'paid') {
        // Activate subscription
        const newEndDate = new Date();
        newEndDate.setMonth(
          newEndDate.getMonth() + subscription.billingCycleMonths,
        );

        await this.subscriptionRepository.update(subscriptionId, {
          status: 'active',
          paymentStatus: 'paid',
          paidAt: new Date(),
          startDate: new Date(),
          endDate: newEndDate,
          nextBillingDate: newEndDate,
        });

        this.logger.log(`Subscription ${subscriptionId} activated`);
        return { success: true, status: 'paid', subscription };
      } else if (status.outcome === 'failed') {
        await this.subscriptionRepository.update(subscriptionId, {
          status: 'payment_failed',
          paymentStatus: 'failed',
        });
        this.logger.warn(`Subscription ${subscriptionId} payment failed`);
        return { success: false, status: 'failed', subscription };
      }

      return { success: false, status: 'pending', subscription };
    } catch (error) {
      this.logger.error(
        `Failed to verify PayMob payment for subscription ${subscriptionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle PayMob webhook
   */
  async handlePayMobWebhook(webhookData: any) {
    try {
      // Process webhook through PaymentService
      const event = await this.paymentService.handleWebhook(
        webhookData,
        'paymob',
      );

      this.logger.log(
        `PayMob webhook received: ${event.eventType} for ${event.transactionId}`,
      );

      // Extract subscription ID from metadata or referenceId
      const subscriptionId = event.rawData?.extras?.referenceId ||
        event.rawData?.obj?.order?.merchant_order_id;

      if (!subscriptionId) {
        this.logger.warn(
          `Subscription ID not found in webhook: ${event.transactionId}`,
        );
        return { received: true, processed: false };
      }

      const subscription = await this.subscriptionRepository.findOne({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        this.logger.warn(
          `Subscription not found: ${subscriptionId}`,
        );
        return { received: true, processed: false };
      }

      // Update subscription based on webhook status
      if (event.status === 'paid') {
        const newEndDate = new Date();
        newEndDate.setMonth(
          newEndDate.getMonth() + subscription.billingCycleMonths,
        );

        await this.subscriptionRepository.update(subscription.id, {
          status: 'active',
          paymentStatus: 'paid',
          paidAt: new Date(),
          startDate: new Date(),
          endDate: newEndDate,
          nextBillingDate: newEndDate,
        });

        this.logger.log(
          `Subscription ${subscription.id} activated via PayMob webhook`,
        );
      } else if (event.status === 'failed') {
        await this.subscriptionRepository.update(subscription.id, {
          status: 'payment_failed',
          paymentStatus: 'failed',
        });
      }

      return { received: true, processed: true, subscriptionId: subscription.id };
    } catch (error) {
      this.logger.error('PayMob webhook processing error:', error);
      throw error;
    }
  }
}
```

#### 2. Controller Implementation

```typescript
// src/subscriptions/subscription-payment.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Logger,
} from '@nestjs/common';
import { SubscriptionPaymentService } from './subscription-payment.service';

@Controller('subscriptions')
export class SubscriptionPaymentController {
  private readonly logger = new Logger(SubscriptionPaymentController.name);

  constructor(
    private readonly subscriptionPaymentService: SubscriptionPaymentService,
  ) {}

  /**
   * Create payment for subscription
   * POST /subscriptions/:subscriptionId/payment
   */
  @Post(':subscriptionId/payment')
  async createPayment(@Param('subscriptionId') subscriptionId: string) {
    try {
      const result =
        await this.subscriptionPaymentService.createSubscriptionPayment(
          subscriptionId,
        );
      return {
        success: true,
        message: 'PayMob payment created successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `PayMob payment creation failed for subscription ${subscriptionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * PayMob callback
   * GET /subscriptions/:subscriptionId/payment/callback
   */
  @Get(':subscriptionId/payment/callback')
  async paymentCallback(
    @Param('subscriptionId') subscriptionId: string,
    @Query('id') transactionId: string,
  ) {
    try {
      const result =
        await this.subscriptionPaymentService.verifySubscriptionPayment(
          subscriptionId,
          transactionId,
        );

      if (result.status === 'paid') {
        return {
          success: true,
          redirectUrl: `/subscriptions/${subscriptionId}/success`,
          message: 'Subscription activated',
        };
      } else {
        return {
          success: false,
          redirectUrl: `/subscriptions/${subscriptionId}/failed`,
          message: 'Payment failed',
        };
      }
    } catch (error) {
      this.logger.error(
        `PayMob callback error for subscription ${subscriptionId}:`,
        error,
      );
      return {
        success: false,
        redirectUrl: `/subscriptions/${subscriptionId}/error`,
        message: 'Payment verification failed',
      };
    }
  }

  /**
   * PayMob webhook endpoint
   * POST /subscriptions/payment/webhook/paymob
   */
  @Post('payment/webhook/paymob')
  async handleWebhook(@Body() webhookData: any) {
    try {
      const result =
        await this.subscriptionPaymentService.handlePayMobWebhook(webhookData);
      return { received: true, ...result };
    } catch (error) {
      this.logger.error('PayMob webhook handling error:', error);
      return { received: true, error: 'Processing failed' };
    }
  }
}
```

---

### Example 3: Stripe - Complete Donation Platform Integration

A complete example showing how to integrate Stripe payments for a donation platform.

#### 1. Service Implementation

```typescript
// src/donations/donation-payment.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';
import { DonationRepository } from './donation.repository';

@Injectable()
export class DonationPaymentService {
  private readonly logger = new Logger(DonationPaymentService.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly donationRepository: DonationRepository,
  ) {}

  /**
   * Create payment for donation using Stripe
   */
  async createDonationPayment(donationId: string) {
    const donation = await this.donationRepository.findOne({
      where: { id: donationId },
    });

    if (!donation) {
      throw new BadRequestException(`Donation ${donationId} not found`);
    }

    try {
      // Step 1: Get available payment methods from Stripe
      const methods = await this.paymentService.getAvailablePaymentMethods(
        donation.amount,
        donation.currency,
        'stripe',
      );

      this.logger.log(
        `Stripe payment methods available: ${methods.paymentMethods.length}`,
      );

      // Step 2: Create payment with Stripe
      const payment = await this.paymentService.createPayment(
        {
          amount: donation.amount,
          currency: donation.currency.toLowerCase(), // Stripe uses lowercase
          referenceId: donationId,
          description: `Donation to ${donation.campaignName}`,
          customerEmail: donation.donorEmail,
          customerName: donation.donorName || 'Anonymous',
          paymentMethodId: donation.paymentMethod || 'card', // card, apple_pay, google_pay
          metadata: {
            donationId: donation.id,
            campaignId: donation.campaignId,
            donorType: donation.isAnonymous ? 'anonymous' : 'registered',
          },
        },
        'stripe', // Use Stripe provider
      );

      // Step 3: Save payment record
      await this.donationRepository.update(donationId, {
        paymentId: payment.id,
        paymentUrl: payment.url, // client_secret or checkout URL
        paymentStatus: payment.status,
        paymentProvider: 'stripe',
      });

      this.logger.log(
        `Stripe payment created for donation ${donationId}: ${payment.id}`,
      );

      return {
        success: true,
        paymentId: payment.id,
        paymentUrl: payment.url, // Use this for Stripe.js or redirect
        clientSecret: payment.url, // For Stripe.js integration
        availableMethods: methods.paymentMethods,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create Stripe payment for donation ${donationId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Verify payment status after Stripe callback
   */
  async verifyDonationPayment(donationId: string, paymentIntentId: string) {
    try {
      // Get payment status from Stripe
      const status = await this.paymentService.getPaymentStatus(
        paymentIntentId,
        'stripe',
      );

      const donation = await this.donationRepository.findOne({
        where: { id: donationId },
      });

      if (!donation) {
        throw new BadRequestException(`Donation ${donationId} not found`);
      }

      // Update donation based on payment status
      if (status.outcome === 'paid') {
        await this.donationRepository.update(donationId, {
          status: 'completed',
          paymentStatus: 'paid',
          paidAt: new Date(),
          receiptSent: false, // Trigger receipt email
        });

        this.logger.log(`Donation ${donationId} marked as paid`);
        return { success: true, status: 'paid', donation };
      } else if (status.outcome === 'failed') {
        await this.donationRepository.update(donationId, {
          status: 'failed',
          paymentStatus: 'failed',
        });
        this.logger.warn(`Donation ${donationId} payment failed`);
        return { success: false, status: 'failed', donation };
      }

      return { success: false, status: 'pending', donation };
    } catch (error) {
      this.logger.error(
        `Failed to verify Stripe payment for donation ${donationId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle Stripe webhook
   */
  async handleStripeWebhook(webhookData: any) {
    try {
      // Process webhook through PaymentService
      const event = await this.paymentService.handleWebhook(
        webhookData,
        'stripe',
      );

      this.logger.log(
        `Stripe webhook received: ${event.eventType} for ${event.transactionId}`,
      );

      // Extract donation ID from metadata
      const donationId = event.rawData?.data?.object?.metadata?.donationId;

      if (!donationId) {
        this.logger.warn(
          `Donation ID not found in Stripe webhook: ${event.transactionId}`,
        );
        return { received: true, processed: false };
      }

      const donation = await this.donationRepository.findOne({
        where: { id: donationId },
      });

      if (!donation) {
        this.logger.warn(`Donation not found: ${donationId}`);
        return { received: true, processed: false };
      }

      // Update donation based on webhook status
      if (event.status === 'paid') {
        await this.donationRepository.update(donation.id, {
          status: 'completed',
          paymentStatus: 'paid',
          paidAt: new Date(),
          receiptSent: false, // Trigger receipt email
        });

        this.logger.log(
          `Donation ${donation.id} completed via Stripe webhook`,
        );
      } else if (event.status === 'failed') {
        await this.donationRepository.update(donation.id, {
          status: 'failed',
          paymentStatus: 'failed',
        });
      }

      return { received: true, processed: true, donationId: donation.id };
    } catch (error) {
      this.logger.error('Stripe webhook processing error:', error);
      throw error;
    }
  }
}
```

#### 2. Controller Implementation

```typescript
// src/donations/donation-payment.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Logger,
} from '@nestjs/common';
import { DonationPaymentService } from './donation-payment.service';

@Controller('donations')
export class DonationPaymentController {
  private readonly logger = new Logger(DonationPaymentController.name);

  constructor(
    private readonly donationPaymentService: DonationPaymentService,
  ) {}

  /**
   * Create payment for donation
   * POST /donations/:donationId/payment
   */
  @Post(':donationId/payment')
  async createPayment(@Param('donationId') donationId: string) {
    try {
      const result =
        await this.donationPaymentService.createDonationPayment(donationId);
      return {
        success: true,
        message: 'Stripe payment created successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Stripe payment creation failed for donation ${donationId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Stripe callback (for redirect-based flows)
   * GET /donations/:donationId/payment/callback
   */
  @Get(':donationId/payment/callback')
  async paymentCallback(
    @Param('donationId') donationId: string,
    @Query('payment_intent') paymentIntentId: string,
  ) {
    try {
      const result =
        await this.donationPaymentService.verifyDonationPayment(
          donationId,
          paymentIntentId,
        );

      if (result.status === 'paid') {
        return {
          success: true,
          redirectUrl: `/donations/${donationId}/success`,
          message: 'Donation successful',
        };
      } else {
        return {
          success: false,
          redirectUrl: `/donations/${donationId}/failed`,
          message: 'Payment failed',
        };
      }
    } catch (error) {
      this.logger.error(
        `Stripe callback error for donation ${donationId}:`,
        error,
      );
      return {
        success: false,
        redirectUrl: `/donations/${donationId}/error`,
        message: 'Payment verification failed',
      };
    }
  }

  /**
   * Stripe webhook endpoint
   * POST /donations/payment/webhook/stripe
   */
  @Post('payment/webhook/stripe')
  async handleWebhook(@Body() webhookData: any) {
    try {
      const result =
        await this.donationPaymentService.handleStripeWebhook(webhookData);
      return { received: true, ...result };
    } catch (error) {
      this.logger.error('Stripe webhook handling error:', error);
      return { received: true, error: 'Processing failed' };
    }
  }

  /**
   * Check payment status
   * GET /donations/:donationId/payment/status
   */
  @Get(':donationId/payment/status')
  async getPaymentStatus(@Param('donationId') donationId: string) {
    try {
      const donation = await this.donationPaymentService.getDonation(donationId);
      if (!donation.paymentId) {
        throw new BadRequestException('No payment found for this donation');
      }

      const status = await this.paymentService.getPaymentStatus(
        donation.paymentId,
        'stripe',
      );

      return {
        success: true,
        status: status.outcome,
        paymentId: status.transactionId,
        amount: status.amount,
        currency: status.currency,
      };
    } catch (error) {
      this.logger.error(
        `Status check failed for donation ${donationId}:`,
        error,
      );
      throw error;
    }
  }
}
```

---

### Example 4: Multi-Provider Setup with Fallback

A complete example showing how to use multiple providers with automatic fallback.

```typescript
// src/payments/multi-provider-payment.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class MultiProviderPaymentService {
  private readonly logger = new Logger(MultiProviderPaymentService.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create payment with automatic provider fallback
   */
  async createPaymentWithFallback(payload: {
    amount: number;
    currency: string;
    referenceId: string;
    customerEmail: string;
    customerName?: string;
  }) {
    // Provider priority order
    const providers: Array<'myfatoorah' | 'stripe' | 'paymob'> = [
      'myfatoorah',
      'stripe',
      'paymob',
    ];

    // Check provider health first
    const healthChecks = await this.paymentService.healthCheck();
    const healthArray = Array.isArray(healthChecks)
      ? healthChecks
      : [healthChecks];

    // Filter healthy providers
    const healthyProviders = providers.filter((provider) => {
      const health = healthArray.find((h) => h.provider === provider);
      return health && health.status === 'healthy';
    });

    if (healthyProviders.length === 0) {
      throw new Error('No healthy payment providers available');
    }

    // Try each provider in priority order
    for (const provider of healthyProviders) {
      try {
        this.logger.log(`Attempting payment with ${provider}`);
        const result = await this.paymentService.createPayment(
          payload,
          provider,
        );
        this.logger.log(`Payment created successfully with ${provider}`);
        return { ...result, provider };
      } catch (error) {
        this.logger.warn(
          `Payment failed with ${provider}: ${error.message}. Trying next provider...`,
        );
        // Continue to next provider
      }
    }

    throw new Error('All payment providers failed');
  }

  /**
   * Get best provider for currency
   */
  async getBestProviderForCurrency(currency: string): Promise<string> {
    const currencyProviderMap: Record<string, string> = {
      KWD: 'myfatoorah',
      SAR: 'myfatoorah',
      AED: 'myfatoorah',
      EGP: 'paymob',
      USD: 'stripe',
      EUR: 'stripe',
    };

    const recommendedProvider = currencyProviderMap[currency] || 'stripe';

    // Check if recommended provider is healthy
    const health = await this.paymentService.healthCheck(recommendedProvider);
    if (health.status === 'healthy') {
      return recommendedProvider;
    }

    // Fallback to any healthy provider
    const allHealth = await this.paymentService.healthCheck();
    const healthArray = Array.isArray(allHealth) ? allHealth : [allHealth];
    const healthy = healthArray.find((h) => h.status === 'healthy');
    return healthy ? healthy.provider : 'myfatoorah';
  }
}
```

---

### Example 5: Health Check Monitoring

A complete example for monitoring payment provider health.

```typescript
// src/admin/payment-health.controller.ts
import { Controller, Get, Logger } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';

@Controller('admin/payments')
export class PaymentHealthController {
  private readonly logger = new Logger(PaymentHealthController.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Get health status of all providers
   * GET /admin/payments/health
   */
  @Get('health')
  async getAllProvidersHealth() {
    try {
      const health = await this.paymentService.healthCheck();
      const healthArray = Array.isArray(health) ? health : [health];

      const summary = {
        total: healthArray.length,
        healthy: healthArray.filter((h) => h.status === 'healthy').length,
        unhealthy: healthArray.filter((h) => h.status === 'unhealthy').length,
        notConfigured: healthArray.filter(
          (h) => h.status === 'not_configured',
        ).length,
        providers: healthArray.map((h) => ({
          provider: h.provider,
          status: h.status,
          configured: h.configured,
          responseTime: h.responseTime,
          message: h.message,
          error: h.error,
        })),
      };

      return {
        success: true,
        timestamp: new Date().toISOString(),
        ...summary,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Get health status of specific provider
   * GET /admin/payments/health/:provider
   */
  @Get('health/:provider')
  async getProviderHealth(@Param('provider') provider: string) {
    try {
      const health = await this.paymentService.healthCheck(
        provider as any,
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
        health: {
          provider: health.provider,
          status: health.status,
          configured: health.configured,
          responseTime: health.responseTime,
          message: health.message,
          error: health.error,
        },
      };
    } catch (error) {
      this.logger.error(`Health check failed for ${provider}:`, error);
      throw error;
    }
  }
}
```

---

### Example 6: Simple E-commerce Order Payment

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly paymentService: PaymentService) {}

  async processOrderPayment(orderId: string, amount: number, currency: string) {
    // Create payment
    const payment = await this.paymentService.createPayment({
      amount,
      currency,
      referenceId: orderId,
      description: `Payment for order #${orderId}`,
      customerEmail: 'customer@example.com',
      customerName: 'John Doe',
    });

    // Save payment to database
    // ... save payment record

    // Return payment URL
    return { paymentUrl: payment.url, paymentId: payment.id };
  }
}
```

### Example 7: Simple Donation Payment

```typescript
@Injectable()
export class DonationService {
  constructor(private readonly paymentService: PaymentService) {}

  async processDonation(donationId: string, amount: number, currency: string) {
    // Create payment
    const payment = await this.paymentService.createPayment({
      amount,
      currency,
      referenceId: donationId,
      description: 'Charity donation',
      customerEmail: 'donor@example.com',
      customerName: 'Anonymous', // Optional for anonymous donations
    });

    // Save donation payment
    // ... save donation record

    return { paymentUrl: payment.url, paymentId: payment.id };
  }
}
```

---

## Best Practices

### 1. Error Handling

Always handle errors when creating payments:

```typescript
try {
  const payment = await this.paymentService.createPayment(payload);
  return { success: true, payment };
} catch (error) {
  if (error instanceof BadRequestException) {
    // Handle validation errors
  } else if (error instanceof UnauthorizedException) {
    // Handle authentication errors
  } else {
    // Handle other errors
  }
  throw error;
}
```

### 2. Payment Status Verification

Always verify payment status after webhook or callback:

```typescript
// After receiving webhook
const status = await this.paymentService.getPaymentStatus(
  transactionId,
  provider,
);

if (status.outcome === 'paid') {
  // Process successful payment
} else if (status.outcome === 'failed') {
  // Handle failed payment
}
```

### 3. Use Generic Reference IDs

Use generic `referenceId` instead of provider-specific IDs:

```typescript
// Good: Generic reference ID
const payment = await this.paymentService.createPayment({
  referenceId: 'order-123', // Works with any provider
  // ...
});

// Bad: Provider-specific
const payment = await this.paymentService.createPayment({
  orderId: 'order-123', // Provider-specific
  // ...
});
```

### 4. Provider Selection

Let users choose provider or use default:

```typescript
// User selects provider
const provider = userSelectedProvider || 'myfatoorah';
const payment = await this.paymentService.createPayment(payload, provider);
```

### 5. Health Checks

Regularly check provider health:

```typescript
// Check provider health before processing payment
const health = await this.paymentService.healthCheck('myfatoorah');
if (health.status !== 'healthy') {
  // Use fallback provider or show error
}
```

### 6. Memory Management

The payment service is optimized for memory:

- Connection pooling for HTTP requests
- Automatic resource cleanup on module destroy
- Limited provider registration (MAX_PROVIDERS = 10)

No additional memory management is required.

---

## Troubleshooting

### Common Issues

#### 1. Provider Not Configured

**Error**: `Provider is not configured`

**Solution**: 
- Check environment variables are set correctly
- Verify provider is registered in `PaymentModule`
- Check `isConfigured()` returns `true`

```typescript
// Check if provider is configured
const myFatooraService = app.get(MyFatooraService);
if (!myFatooraService.isConfigured()) {
  console.error('MyFatoorah is not configured');
}
```

#### 2. Authentication Failed

**Error**: `401 Unauthorized` or `Authentication failed`

**Solution**:
- Verify API key is correct
- Check API key format (no extra spaces)
- Ensure API key has required permissions
- For PayMob: Verify secret key format (`egy_sk_test_...`)

#### 3. Payment Method Not Available

**Error**: Payment method not found or not available

**Solution**:
- Check payment method ID is correct
- Verify payment method is enabled in provider dashboard
- Use `getAvailablePaymentMethods()` to get available methods

#### 4. Webhook Not Received

**Error**: Webhook not being received

**Solution**:
- Verify webhook URL is accessible from internet
- Check webhook URL in provider dashboard
- Verify webhook signature validation (if implemented)
- Check server logs for webhook requests

#### 5. Payment Status Not Updating

**Error**: Payment status remains "pending"

**Solution**:
- Verify webhook is working
- Manually check payment status using `getPaymentStatus()`
- Check payment expiry date (payments may expire)
- Verify transaction ID is correct

#### 6. Health Check Failing

**Error**: Health check returns `unhealthy`

**Solution**:
- Check provider API is accessible
- Verify API credentials
- Check network connectivity
- Review provider API status page

### Debugging

#### Enable Debug Logging

```typescript
// In your service
private readonly logger = new Logger(YourService.name);

// Log payment creation
this.logger.debug('Creating payment', { payload });

// Log payment result
this.logger.debug('Payment created', { result });
```

#### Check Provider Health

```typescript
// Check all providers
const health = await this.paymentService.healthCheck();
console.log('Provider health:', health);

// Check specific provider
const health = await this.paymentService.healthCheck('myfatoorah');
console.log('MyFatoorah health:', health);
```

#### Verify Configuration

```typescript
// Check if provider is configured
const myFatooraService = app.get(MyFatooraService);
console.log('MyFatoorah configured:', myFatooraService.isConfigured());
```

---

## Additional Resources

- [MyFatoorah API Documentation](https://myfatoorah.readme.io/docs)
- [PayMob API Documentation](https://docs.paymob.com/)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [NestJS Documentation](https://docs.nestjs.com/)

---

## Support

For issues, questions, or contributions, please contact the development team or create an issue in the project repository.

---

---

## Payment Reconciliation Service

### Overview

The Payment Reconciliation Service automatically monitors and reconciles pending payments. It runs as a cron job every 3 minutes to:

1. Find payments that are pending for more than 15 minutes
2. Check their status with the payment provider
3. Update them to 'failed' if still pending after 15 minutes
4. Update them to 'paid' or 'failed' if status changed

### Features

- ✅ **Automatic Reconciliation**: Runs every 3 minutes via cron job
- ✅ **Timeout Detection**: Marks payments as failed if pending for more than 15 minutes
- ✅ **Provider-Agnostic**: Works with all payment providers (MyFatoorah, PayMob, Stripe)
- ✅ **Smart Provider Detection**: Automatically detects which provider was used
- ✅ **Manual Reconciliation**: Supports manual reconciliation via API endpoints
- ✅ **Statistics**: Provides statistics about pending payments

### Configuration

The service is automatically enabled when `PaymentModule` is imported. No additional configuration is required.

**Timeout Configuration:**
- Default timeout: 15 minutes
- Can be modified in `PaymentReconciliationService.PENDING_TIMEOUT_MS`

**Cron Schedule:**
- Default: Every 3 minutes (`*/3 * * * *`)
- Can be modified in `@Cron()` decorator

### Usage

#### Automatic Reconciliation

The service automatically runs every 3 minutes. No action required.

#### Manual Reconciliation

```typescript
import { PaymentReconciliationService } from './payment/payment-reconciliation.service';

@Injectable()
export class YourService {
  constructor(
    private readonly reconciliationService: PaymentReconciliationService,
  ) {}

  // Reconcile all pending payments
  async reconcileAll() {
    const result = await this.reconciliationService.reconcilePendingPayments();
    console.log(`Processed: ${result.processed}, Updated: ${result.updated}`);
  }

  // Reconcile specific payment
  async reconcilePayment(paymentId: string) {
    const result = await this.reconciliationService.reconcilePaymentById(
      paymentId,
    );
    return result;
  }

  // Get statistics
  async getStats() {
    const stats = await this.reconciliationService.getPendingPaymentsStats();
    return stats;
  }
}
```

#### API Endpoints

```typescript
// Reconcile all pending payments
POST /payment-reconciliation/reconcile

// Reconcile specific payment
POST /payment-reconciliation/reconcile/:paymentId

// Get statistics
GET /payment-reconciliation/stats
```

### How It Works

1. **Find Pending Payments**: Queries database for payments with:
   - Status = 'pending'
   - Created more than 15 minutes ago

2. **Detect Provider**: Automatically detects which provider was used:
   - Checks `rawResponse` metadata
   - Checks `transactionId` format
   - Falls back to active provider

3. **Check Status**: Calls `PaymentService.getPaymentStatus()` to verify current status

4. **Update Status**:
   - If still pending after 15 minutes → Mark as 'failed'
   - If status changed to 'paid' → Update to 'paid'
   - If status changed to 'failed' → Update to 'failed'

5. **Log Reconciliation**: Stores reconciliation details in `rawResponse.reconciliation`

### Example: Reconciliation Result

```typescript
{
  processed: 10,  // Total payments processed
  updated: 5,     // Payments that were updated
  failed: 3,      // Payments marked as failed
  errors: 0       // Errors during processing
}
```

### Statistics

```typescript
{
  totalPending: 25,           // Total pending payments
  pendingOver15Min: 5,        // Pending payments over 15 minutes
  oldestPendingMinutes: 45,   // Age of oldest pending payment
  oldestPendingDate: "2025-01-01T10:00:00Z"
}
```

### Best Practices

1. **Monitor Statistics**: Regularly check `/payment-reconciliation/stats` to monitor pending payments

2. **Manual Reconciliation**: Use manual reconciliation for urgent cases or testing

3. **Error Handling**: The service continues processing even if individual payments fail

4. **Performance**: Processes up to 100 payments per run to avoid overload

5. **Logging**: All reconciliation activities are logged for auditing

---

**Last Updated**: January 2025  
**Version**: 2.0.0
