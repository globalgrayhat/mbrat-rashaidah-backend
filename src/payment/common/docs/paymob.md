# PayMob Provider Handbook

> Supports Egypt, Saudi Arabia, UAE, Oman, Pakistan. Two APIs available: **Intention API (recommended)** and **Legacy API**.

---

## 1. Capabilities

| Feature | Intention API | Legacy API |
|---------|---------------|-----------|
| Card payments | ✅ | ✅ |
| Wallets (Vodafone Cash, STC, etc.) | ✅ | ✅ |
| Tokenized payments | ✅ | Limited |
| Multi-country base URLs | ✅ | ✅ |
| Webhooks | ✅ | ✅ |
| Health check | ✅ | ✅ |

---

## 2. Configuration

### 2.1 Environment Variables (Intention API)

```env
PAYMOB_SECRET_KEY=egy_sk_test_...
PAYMOB_COUNTRY=EGYPT
PAYMOB_INTENTION_BASE_URL=https://accept.paymob.com/v1/intention
PAYMOB_INTEGRATION_ID=123456
PAYMOB_IFRAME_ID=987654
PAYMOB_CALLBACK_URL=https://yourdomain.com/paymob/callback
PAYMOB_DEFAULT_CURRENCY=EGP
```

### 2.2 Environment Variables (Legacy API)

```env
PAYMOB_API_KEY=ZXlKaGJHY2lPaUpJV...
PAYMOB_BASE_URL=https://accept.paymob.com/api
PAYMOB_INTEGRATION_ID=123456
PAYMOB_CALLBACK_URL=https://yourdomain.com/paymob/callback
```

### 2.3 Country Matrix

| Country | Base URL | Default Currency | Secret Key Prefix |
|---------|----------|------------------|-------------------|
| Egypt | `https://accept.paymob.com` | EGP | `egy_...` |
| Saudi Arabia | `https://ksa.paymob.com` | SAR | `ksa_...` |
| United Arab Emirates | `https://uae.paymob.com` | AED | `uae_...` |
| Oman | `https://oman.paymob.com` | OMR | `omn_...` |
| Pakistan | `https://pakistan.paymob.com` | PKR | `pak_...` |

Set `PAYMOB_COUNTRY` to any of the above to auto-pick defaults.

---

## 3. Payment Flow (Intention API)

```
Create donation/order → call PaymentService.createPayment(..., 'paymob')
    ↓ PayMobService decides Intention API or Legacy based on config
    ↓ POST /v1/intention → returns payment link/token
Redirect user to PayMob hosted page or iframe
PayMob calls callback + webhook
Backend verifies via PaymentService.getPaymentStatus(transactionId, 'paymob')
```

### 3.1 Creating an Intention

```typescript
const payment = await this.paymentService.createPayment(
  {
    amount: 250,
    currency: 'EGP',
    referenceId: subscriptionId,
    description: `Subscription ${plan.name}`,
    customerEmail: user.email,
    customerName: user.fullName,
    customerMobile: user.phone,
    paymentMethodId: 'card', // or specific integration ID e.g. 12
    metadata: { planId: plan.id },
  },
  'paymob',
);
// payment.url → intention redirect URL
```

### 3.2 Wallet vs Card

* **Card** payments: use `'card'` or integration ID representing card acceptance.
* **Wallet** payments: use integration IDs assigned to each wallet (e.g., 24 for Vodafone Cash). Check your PayMob dashboard.

### 3.3 Callback Parameters

PayMob appends `id` (transaction ID) and `success` flag to the callback URL. Always verify using `getPaymentStatus` before marking as paid.

---

## 4. Webhooks & Validation

* Webhook endpoint: `/webhooks/paymob` (handled by `WebhookController`).  
* PayMob sends an HMAC header (`hmac`). Currently the service logs the payload; if you need strict validation, extend `validateWebhook` using the provided HMAC env (`PAYMOB_HMAC`).  
* `PaymentService.handleWebhook(payload, 'paymob')` normalizes the event:
  * `transactionId`
  * `status` (`paid`, `failed`, `pending`)
  * `rawData` (original payload)

Example usage:
```typescript
const event = await this.paymentService.handleWebhook(payload, 'paymob');
await this.subscriptionService.onGatewayEvent(event);
```

---

## 5. Health Check

`healthCheck()` tries a lightweight authenticated request:
* Intention API: GET `.../v1/intention/test` (non-existing endpoint expected to return 404 but proves auth).
* Legacy API: `/auth/tokens` flow.

Interpretation:
* `healthy` → credentials valid and network reachable.
* `unhealthy` + `error` → check key, base URL, or firewall.
* `not_configured` → env vars missing; provider inactive.

---

## 6. Troubleshooting

| Issue | Possible Cause | Resolution |
|-------|----------------|------------|
| 401 Unauthorized | Incorrect secret key prefix vs country | Ensure `PAYMOB_SECRET_KEY` matches the region (e.g., `egy_...` for Egypt). |
| Payment stuck pending | Callback not reachable, or user abandoned payment | Ensure callback URL is public; use `getPaymentStatus` + reconciliation cron. |
| Wallet method missing | Integration ID not enabled | Enable the wallet in PayMob dashboard and update `paymentMethodId`. |
| Wrong currency | Country default overrides provided currency | Define `PAYMOB_DEFAULT_CURRENCY` or pass `currency` explicitly in the payload. |
| Invalid phone/address errors | PayMob requires detailed billing info for certain methods | Provide `billingData` in metadata or extend `PayMobService` to include addresses. |

---

## 7. Testing Notes

1. Use `PAYMOB_SECRET_KEY` from the test account (provided in README by the team).  
2. Call `/payment-methods/available?provider=paymob&invoiceAmount=50&currencyIso=EGP`.  
3. Create payment with `paymentMethodId: 'card'`. You should receive an `intentionUrl`.  
4. Simulate callback/webhook using PayMob’s Postman collection or by copying the JSON from the dashboard logs.  
5. Verify `PaymentService.getPaymentStatus(transactionId, 'paymob')` responds with `paid` after successful test payment.  

---

## 8. FAQ

**Q: Can I mix Intention and Legacy APIs?**  
A: The provider decides automatically. If `secretKey` exists, Intention API takes precedence. Remove it to fall back to legacy.

**Q: How do I support multiple countries simultaneously?**  
A: Use multiple PayMob merchant accounts (one per country) and register separate provider instances if needed. Currently the module handles one PayMob config at a time.

**Q: How do I show available wallets/cards in the UI?**  
A: Call `/payment-methods/available?provider=paymob` and render the returned `paymentMethods` list. Each item includes PayMob’s `Id`/`name`. Frontend should map user choice back to `paymentMethodId` when creating a payment.

