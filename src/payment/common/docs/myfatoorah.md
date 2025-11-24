# MyFatoorah Provider Handbook

> Region focus: GCC & Middle East. Status: Enabled by default in this project.

---

## 1. Capabilities at a Glance

| Feature | Supported |
|---------|-----------|
| Payment methods | KNET, MADA, VISA/MASTER, AMEX, Benefit, Apple Pay, Google Pay, STC Pay, Qatar/UAE debit, Oman Net, Meeza, Egypt wallets, etc. |
| Payment method discovery | `InitiatePayment` returns live methods + service charges (used by `/payment-methods/available`). |
| Invoice TTL | Configurable via env (`MYFATOORAH_INVOICE_TTL_MINUTES`). |
| Payment creation | `SendPayment` endpoint. |
| Status lookup | `GetPaymentStatus` via InvoiceId or PaymentId. |
| Webhooks | Supported via `/webhooks/myfatoora`. |
| Health check | Light `GetPaymentStatus` probe with dummy ID (expects 404). |

---

## 2. Configuration

### 2.1 Environment Variables

```env
MYFATOORAH_API_KEY=your_api_key
MYFATOORAH_API_URL=https://apitest.myfatoorah.com
MYFATOORAH_CALLBACK_URL=https://yourdomain.com/payment/success
MYFATOORAH_ERROR_URL=https://yourdomain.com/payment/error
MYFATOORAH_INVOICE_TTL_MINUTES=60
MYFATOORAH_TIMEZONE=Asia/Kuwait
MYFATOORAH_TTL_SKEW_SECONDS=30
```

> **Production Tip:** Switch `MYFATOORAH_API_URL` to the live endpoint and rotate API keys per environment.

### 2.2 Checklist

1. Enable the payment methods you need in the MyFatoorah merchant dashboard.
2. Set callback/error URLs in both the dashboard **and** env variables.
3. If you intend to use Apple Pay / Google Pay, ensure your merchant ID is approved in the dashboard.

---

## 3. Payment Flow

```
Client requests /payment-methods/available
    ↓ MyFatooraService.initiatePayment()
User selects payment method (id/code from response)
    ↓ PaymentService.createPayment(payload, 'myfatoorah')
        ↓ MyFatooraService.createPayment() -> SendPayment
    ← returns { id: InvoiceId, url: InvoiceURL }
Client redirects to url
    ↓ MyFatoorah callback / webhook
Backend verifies via PaymentService.getPaymentStatus()
```

### 3.1 Sample `getAvailablePaymentMethods` Response

```json
{
  "success": true,
  "paymentMethods": [
    {
      "id": 1,
      "code": "kn",
      "nameEn": "KNET",
      "nameAr": "كي نت",
      "serviceCharge": 1.01,
      "totalAmount": 10,
      "currency": "KWD",
      "imageUrl": "https://demo.myfatoorah.com/imgs/payment-methods/kn.png",
      "minLimit": 1,
      "maxLimit": 5000
    }
  ],
  "invoiceAmount": 10,
  "currency": "KWD",
  "timestamp": "2025-02-01T10:00:00.000Z",
  "provider": "myfatoorah"
}
```

### 3.2 Creating an Invoice

```typescript
const payment = await this.paymentService.createPayment(
  {
    amount: 25,
    currency: 'KWD',
    referenceId: `order-${order.id}`,
    description: `Order #${order.orderNumber}`,
    customerEmail: order.customerEmail,
    customerName: order.customerName,
    customerMobile: order.customerPhone,
    paymentMethodId: selectedMethodId, // e.g., 11 for Apple Pay
  },
  'myfatoorah',
);
// payment.url = InvoiceURL → redirect user
```

### 3.3 Handling Webhooks

```typescript
@Post('webhooks/myfatoora')
async handle(@Body() payload: MyFatooraWebhookEvent) {
  const normalized = await this.paymentService.handleWebhook(payload, 'myfatoorah');
  await this.ordersService.processGatewayWebhook(normalized);
}
```

`PaymentService.handleWebhook` extracts:
* `transactionId` → InvoiceId
* `status` → `paid | failed | pending`
* `paymentMethodId` (if present)

### 3.4 Verifying Status Manually

```typescript
const status = await this.paymentService.getPaymentStatus(invoiceId, 'myfatoorah');
if (status.outcome === 'paid') {
  // fulfill order
}
```

---

## 4. Advanced Configuration

### 4.1 Invoice TTL & Timezone

* `invoiceTtlMinutes` decides when MyFatoorah expires the invoice.
* `ttlSkewSeconds` adds a buffer to avoid marking fresh invoices as failed.
* `timezone` affects expiry timestamp generated in the provider.

### 4.2 Direct vs Redirect Payments

* Apple Pay / Google Pay are flagged as `isDirectPayment: true` in responses.  
  The frontend can show them differently but the backend does not change behavior; MyFatoorah handles the direct flow in its payment page.

### 4.3 Multi-currency

* MyFatoorah supports several currencies; ensure the merchant profile allows the currency you pass.  
  If not, the API will respond with a validation error.

---

## 5. Error Handling Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Callback URL is required` | `MYFATOORAH_CALLBACK_URL` missing | Set env var or pass config object when instantiating the service. |
| `Payment initiation failed: Missing InvoiceURL or InvoiceId` | MyFatoorah returned incomplete data | Usually happens when API key is valid but merchant is not allowed for requested method. Check dashboard. |
| `UnauthorizedException` | Wrong API key or using live key against test endpoint | Double check API base URL and key. |
| `No data match the provided values` during status check | InvoiceId/PaymentId not found | Payment expired or wrong ID. Use reconciliation service or re-initiate payment. |

Logs are printed with `operationName` (e.g., `Initiate MyFatoorah payment error`). Always inspect Nest logs to see the original MyFatoorah payload.

---

## 6. Testing Checklist

1. Use MyFatoorah sandbox credentials.  
2. Hit `/payment-methods/available?currencyIso=KWD&invoiceAmount=1`. Ensure you receive live methods.  
3. Create a payment and confirm you’re redirected to the sandbox page.  
4. Trigger webhooks manually via the MyFatoorah dashboard or by calling the webhook endpoint with a sample payload.  
5. Run `npm run build` to ensure DTO/validation changes (like `paymentMethod` string) are respected.  

---

## 7. FAQ

**Q: Can I force a specific payment method?**  
A: Yes, set `paymentMethodId` in the payload. If omitted, MyFatoorah shows the list to the user.

**Q: Why do payment methods differ between environments?**  
A: Sandbox profiles often have fewer payment methods enabled. Mirror production settings in the dashboard if you need parity.

**Q: Do I need to store `PaymentMethodEnum`?**  
A: No. The system now stores provider IDs as strings, so Apple Pay = `11` (MyFatoorah) is not the same as `apple_pay` (Stripe). Always keep the provider name + method ID together if you need to persist preferences.

