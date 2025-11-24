# Scenario Examples & Usage Cookbook

> Each section contains a service snippet + corresponding controller (or REST flow) for a specific use case. Copy, adapt, and plug into your NestJS modules.

---

## 1. Donations (Stripe)

### 1.1 Service

```typescript
@Injectable()
export class DonationPaymentService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly donationRepository: DonationRepository,
  ) {}

  async initiateStripeDonation(donationId: string) {
    const donation = await this.donationRepository.findOneByOrFail({ id: donationId });

    const payment = await this.paymentService.createPayment(
      {
        amount: donation.amount,
        currency: donation.currency.toLowerCase(),
        referenceId: donation.id,
        description: `Donation for ${donation.campaignName}`,
        customerEmail: donation.donorEmail,
        customerName: donation.donorName ?? 'Anonymous',
        paymentMethodId: donation.paymentMethod ?? 'card',
        metadata: {
          donationId: donation.id,
          campaignId: donation.campaignId,
        },
      },
      'stripe',
    );

    donation.paymentId = payment.id;
    donation.paymentUrl = payment.url; // client_secret
    donation.paymentStatus = payment.status;
    await this.donationRepository.save(donation);

    return { clientSecret: payment.url, paymentId: payment.id };
  }
}
```

### 1.2 Controller

```typescript
@Post(':donationId/payment')
createDonationPayment(@Param('donationId') donationId: string) {
  return this.donationPaymentService.initiateStripeDonation(donationId);
}
```

### 1.3 Frontend Hint

Use Stripe.js `confirmCardPayment(clientSecret)` with the client secret returned above. To fetch payment methods, call `GET /payment-methods/available?provider=stripe&invoiceAmount=amount&currencyIso=USD`.

---

## 2. Donations (MyFatoorah)

Same flow as Stripe, but provider `'myfatoorah'` and `payment.url` is a redirect link. Example controller response:

```typescript
return {
  paymentId: payment.id,
  redirectUrl: payment.url,
  methods: methods.paymentMethods,
};
```

Frontend should open `redirectUrl` in a new tab or redirect the entire SPA.

---

## 3. Subscription Billing (PayMob Intention API)

```typescript
@Injectable()
export class SubscriptionPaymentService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async charge(subscriptionId: string) {
    const subscription = await this.subscriptions.findOneByOrFail({ id: subscriptionId });

    const payment = await this.paymentService.createPayment(
      {
        amount: subscription.amount,
        currency: subscription.currency,
        referenceId: subscription.id,
        description: `Subscription ${subscription.planName}`,
        customerEmail: subscription.userEmail,
        customerName: subscription.userName,
        customerMobile: subscription.userPhone,
        paymentMethodId: 'card', // or integration ID
      },
      'paymob',
    );

    subscription.paymentId = payment.id;
    subscription.paymentUrl = payment.url;
    subscription.paymentStatus = payment.status;
    await this.subscriptions.save(subscription);

    return { redirectUrl: payment.url };
  }
}
```

Webhook handler:

```typescript
@Post('webhooks/paymob')
async handlePayMobWebhook(@Body() payload: any) {
  const event = await this.paymentService.handleWebhook(payload, 'paymob');
  await this.subscriptionPaymentService.onGatewayEvent(event);
}
```

---

## 4. E-commerce Order (MyFatoorah)

### 4.1 Service

```typescript
async checkout(orderId: string) {
  const order = await this.orders.findOneByOrFail({ id: orderId });

  const methods = await this.paymentService.getAvailablePaymentMethods(
    order.totalAmount,
    order.currency,
    'myfatoorah',
  );

  const payment = await this.paymentService.createPayment(
    {
      amount: order.totalAmount,
      currency: order.currency,
      referenceId: order.id,
      description: `Order #${order.orderNumber}`,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      customerMobile: order.customerPhone,
      paymentMethodId: order.selectedPaymentMethod, // optional
      metadata: { orderNumber: order.orderNumber },
    },
    'myfatoorah',
  );

  await this.orders.update(order.id, {
    paymentId: payment.id,
    paymentUrl: payment.url,
    paymentStatus: payment.status,
  });

  return {
    paymentUrl: payment.url,
    paymentId: payment.id,
    availableMethods: methods.paymentMethods,
  };
}
```

### 4.2 Callback Handler

```typescript
@Get(':orderId/payment/callback')
async handleCallback(
  @Param('orderId') orderId: string,
  @Query('paymentId') paymentId: string,
  @Query('Id') invoiceId: string,
) {
  const status = await this.paymentService.getPaymentStatus(invoiceId ?? paymentId, 'myfatoorah');
  await this.ordersService.applyGatewayStatus(orderId, status);
  return status;
}
```

---

## 5. Multi-Provider Fallback

```typescript
async createPaymentWithFallback(payload: PaymentPayload) {
  const candidates: PaymentProviderType[] = ['myfatoorah', 'stripe', 'paymob'];
  const health = await this.paymentService.healthCheck();
  const healthArray = Array.isArray(health) ? health : [health];

  for (const provider of candidates) {
    const providerHealth = healthArray.find((h) => h.provider === provider);
    if (!providerHealth || providerHealth.status !== 'healthy') continue;

    try {
      return await this.paymentService.createPayment(payload, provider);
    } catch (err) {
      this.logger.warn(`Provider ${provider} failed → ${err.message}`);
    }
  }

  throw new InternalServerErrorException('All payment providers failed.');
}
```

---

## 6. Manual Reconciliation API

```typescript
@Controller('admin/payments')
export class PaymentReconciliationController {
  constructor(private readonly reconciliation: PaymentReconciliationService) {}

  @Post('reconcile')
  runCronNow() {
    return this.reconciliation.reconcilePendingPayments();
  }

  @Post('reconcile/:paymentId')
  reconcileSingle(@Param('paymentId') paymentId: string) {
    return this.reconciliation.reconcilePaymentById(paymentId);
  }

  @Get('stats')
  getStats() {
    return this.reconciliation.getPendingPaymentsStats();
  }
}
```

---

## 7. Admin Health Dashboard

```typescript
@Controller('admin/payment-health')
export class PaymentHealthController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  async getAll() {
    const health = await this.paymentService.healthCheck();
    return Array.isArray(health) ? health : [health];
  }

  @Get(':provider')
  async getOne(@Param('provider') provider: PaymentProviderType) {
    return this.paymentService.healthCheck(provider);
  }
}
```

Frontends can poll `/admin/payment-health` and render status badges (healthy / unhealthy / not configured).

---

## 8. Registering a Custom Provider (Template)

```typescript
@Injectable()
export class CustomGatewayProvider implements IPaymentProvider {
  readonly providerName = 'custompay';

  constructor(private readonly config: CustomConfigService) {}

  isConfigured() {
    return !!this.config.customPayApiKey;
  }

  async createPayment(payload: PaymentPayload) {
    // call custom API here
    return {
      id: 'txn_123',
      url: 'https://custompay.com/pay/txn_123',
      status: 'pending',
      rawResponse: {},
    };
  }

  async getPaymentStatus(transactionId: string) {
    // map custom statuses to paid/failed/pending
    return { outcome: 'paid', transactionId, raw: {} };
  }

  async getAvailablePaymentMethods(amount: number, currency: string) {
    return {
      success: true,
      paymentMethods: [
        { id: 'wallet', code: 'wallet', nameEn: 'Custom Wallet', isDirectPayment: false },
      ],
      invoiceAmount: amount,
      currency,
      timestamp: new Date().toISOString(),
    };
  }

  async handleWebhook(payload: any) {
    return {
      eventType: payload.event,
      transactionId: payload.transactionId,
      status: payload.status,
      amount: payload.amount,
      currency: payload.currency,
      rawData: payload,
      timestamp: new Date().toISOString(),
    };
  }
}
```

Register it in `PaymentModule` by adding the provider to the `providers` array and injecting it into `PaymentService`.

---

## 9. Frontend Integration Notes

1. Always call `/payment-methods/available?invoiceAmount=X&currencyIso=Y&provider=Z` to render the actual methods from the selected provider.
2. For donations/orders where the user picks a specific method ID, send that ID directly in the POST body (number or string).
3. Handle `payment.url` differently per provider:
   * MyFatoorah / PayMob (redirect) → open in new tab or replace window location.
   * Stripe Payment Intent → treat `payment.url` as client secret and confirm via Stripe.js.
4. Listen for status updates or poll `/donations/:id/payment/status` (or similar endpoints) until the backend marks it as `paid`.

---

Need more scenarios? Copy the structure above and adapt to your module. Every example sticks to `PaymentService` so you can swap providers without rewriting business logic.

