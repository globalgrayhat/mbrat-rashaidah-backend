# Stripe Provider Handbook

> Global coverage with Payment Intents and Checkout Sessions. Supports cards, Apple Pay, Google Pay, and other Stripe-enabled wallets.

---

## 1. Capabilities

| Feature | Supported |
|---------|-----------|
| Payment Intents (client secret) | ✅ |
| Checkout Sessions (redirect) | ✅ |
| Apple Pay / Google Pay | ✅ (via Payment Intents or Checkout) |
| Webhooks | ✅ (`/webhooks/stripe`) |
| Health check | ✅ (`GET /v1/balance`) |
| Multi-currency | ✅ (lowercase currency codes) |

---

## 2. Configuration

### 2.1 Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_API_VERSION=2023-10-16
STRIPE_API_URL=https://api.stripe.com/v1
STRIPE_SUCCESS_URL=https://yourdomain.com/payment/success
STRIPE_CANCEL_URL=https://yourdomain.com/payment/cancel
```

* `STRIPE_SECRET_KEY` – required for all server calls.
* `STRIPE_WEBHOOK_SECRET` – optional but recommended for verifying webhook signatures.
* `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` – used when the provider creates Checkout Sessions.

### 2.2 Notes

* Stripe expects **lowercase** currency codes (`usd`, `eur`, etc.). The provider automatically converts to lowercase but make sure to pass valid ISO codes.
* Apple Pay / Google Pay are enabled via Stripe Dashboard → Payment Methods. No code changes required once they’re active.

---

## 3. Payment Flow

```
createPayment(payload, 'stripe')
    ↓ StripeService.createPayment()
      - Builds PaymentIntent or Checkout Session
    ↓ Returns { id: paymentIntentId, url: client_secret or checkout_url }
Frontend uses Stripe.js or redirects user
Stripe triggers webhook → backend processes via PaymentService.handleWebhook(...)
Backend optionally calls getPaymentStatus for final confirmation
```

### 3.1 Choosing Intent vs Checkout

* If the payload contains `metadata.checkoutMode === 'redirect'`, the provider can create a Checkout Session.
* Default behavior is Payment Intent (client secret). The `payment.url` returned is the `client_secret`. Your frontend should call Stripe.js `confirmCardPayment(clientSecret)`.

### 3.2 Creating a Payment Intent

```typescript
const payment = await this.paymentService.createPayment(
  {
    amount: 4999, // amount in smallest currency unit (cents)
    currency: 'usd',
    referenceId: order.id,
    description: `Order #${order.orderNumber}`,
    customerEmail: order.customerEmail,
    metadata: { orderNumber: order.orderNumber },
    paymentMethodId: 'card', // or 'apple_pay', 'google_pay'
  },
  'stripe',
);

// payment.url => client_secret
return { clientSecret: payment.url };
```

### 3.3 Using Checkout Sessions

```typescript
const payment = await this.paymentService.createPayment(
  {
    amount: 2000,
    currency: 'usd',
    referenceId: subscriptionId,
    description: 'Monthly subscription',
    customerEmail: user.email,
    metadata: { checkoutMode: 'redirect' }, // hint to use Checkout Session
  },
  'stripe',
);

// payment.url => checkout session URL
return { redirectUrl: payment.url };
```

---

## 4. Webhooks

* Endpoint: `/webhooks/stripe`
* Stripe sends events like `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`.
* `PaymentService.handleWebhook(payload, 'stripe')` normalizes the event:
  * `transactionId` = PaymentIntent ID or Checkout Session ID
  * `status` = `paid | failed | pending`
  * `rawData` = original Stripe event

### 4.1 Signature Validation

If `STRIPE_WEBHOOK_SECRET` is set, extend `StripeService.validateWebhook` to verify signatures using Stripe’s SDK. By default, the service accepts all payloads (useful during local development).

---

## 5. Health Check

* `healthCheck()` calls `GET /v1/balance`. If the API key is valid, the provider reports `healthy`.
* In case of bad credentials, the method returns `unhealthy` with the error message (usually 401 or 403).

---

## 6. Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| `No such payment_intent` | Wrong ID stored locally | Ensure you persist `payment.id` returned from `createPayment`. |
| `You cannot confirm this PaymentIntent because it has status requires_payment_method` | Frontend never completed the Stripe.js confirmation | Prompt the user to re-enter card details or re-initiate payment. |
| Webhook not triggered | Endpoint unreachable or wrong signing secret | Use `stripe listen --forward-to localhost:3003/webhooks/stripe` during dev; ensure signing secret matches. |
| Apple Pay button not visible | Apple Pay not enabled in dashboard or domain not registered | Follow Stripe docs to register your domain for Apple Pay. |
| Amount mismatch | Stripe expects amounts in the **smallest unit** (cents) | Multiply major units by 100 before calling `createPayment`. |

---

## 7. Testing

1. Use Stripe CLI: `stripe login` → `stripe listen --forward-to localhost:3003/webhooks/stripe`.
2. Call `/payment-methods/available?provider=stripe&invoiceAmount=20&currencyIso=USD` to confirm Stripe returns methods.
3. Create a payment and confirm with Stripe test cards (`4242 4242 4242 4242` etc.).
4. Verify events in the CLI and ensure your service updates local payments accordingly.

---

## 8. FAQ

**Q: How do I support multiple payment methods (card, Apple Pay) per donation?**  
A: On the frontend, show Stripe’s supported methods (Apple Pay button or Payment Request button). When the user chooses Apple Pay, Stripe handles it automatically after you pass the same client secret. No extra backend changes needed.

**Q: Can I save cards for later?**  
A: Not yet in this codebase. To add card-on-file, extend `StripeService` to create SetupIntents and store Stripe Customer IDs.

**Q: How do I localize currencies?**  
A: Pass the desired currency (lowercase) in `createPayment`. Stripe automatically handles currency conversion if the account supports it. Use `getAvailablePaymentMethods` to confirm the payment methods available for that currency.

