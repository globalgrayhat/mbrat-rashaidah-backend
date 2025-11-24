# Payment System Architecture

## نظرة عامة

تم تصميم نظام الدفع ليكون **مرنًا وقابلًا للتوسع** ويدعم **مقدمي خدمة متعددين** (MyFatoorah, Stripe, PayMob, etc.) بدون تكرار في الكود (DRY Principle).

## المميزات

✅ **دعم متعدد المقدمين**: MyFatoorah, Stripe, PayMob، وأي مقدم خدمة آخر  
✅ **قابل لإعادة الاستخدام**: يمكن استخدامه في مشاريع أخرى (e-commerce, منصات)  
✅ **مبدأ DRY**: لا يوجد تكرار في الكود  
✅ **تصميم بسيط ومرن**: سهل الفهم والصيانة  
✅ **إعدادات مثالية للأداء**: محسّن للسرعة والكفاءة  

## البنية المعمارية

### 1. IPaymentProvider Interface

واجهة موحدة يجب أن يطبقها كل مقدم خدمة:

```typescript
interface IPaymentProvider {
  readonly providerName: string;
  readonly providerVersion?: string;
  
  isConfigured(): boolean;
  createPayment(payload: PaymentPayload): Promise<PaymentResult>;
  getPaymentStatus(transactionId: string, keyType?: string): Promise<PaymentStatusResult>;
  getAvailablePaymentMethods(invoiceAmount: number, currencyIso: string): Promise<AvailablePaymentMethodsResponse>;
  handleWebhook(webhookData: any): Promise<PaymentWebhookEvent>;
  validateWebhook?(webhookData: any): Promise<boolean>;
}
```

### 2. PaymentService Manager

خدمة موحدة تدير جميع مقدمي الخدمة:

```typescript
@Injectable()
export class PaymentService {
  // تسجيل مقدم خدمة جديد
  registerProvider(type: PaymentProviderType, provider: IPaymentProvider): void;
  
  // إنشاء دفعة باستخدام المقدم النشط
  async createPayment(payload: PaymentPayload, providerType?: PaymentProviderType): Promise<PaymentResult>;
  
  // الحصول على حالة الدفعة
  async getPaymentStatus(transactionId: string, keyType?: string, providerType?: PaymentProviderType): Promise<PaymentStatusResult>;
  
  // الحصول على طرق الدفع المتاحة
  async getAvailablePaymentMethods(invoiceAmount: number, currencyIso: string, providerType?: PaymentProviderType): Promise<AvailablePaymentMethodsResponse>;
  
  // معالجة webhook
  async handleWebhook(webhookData: any, providerType: PaymentProviderType): Promise<PaymentWebhookEvent>;
}
```

### 3. MyFatooraService Implementation

تنفيذ MyFatoorah يطبق `IPaymentProvider`:

```typescript
@Injectable()
export class MyFatooraService implements PaymentService, IPaymentProvider {
  readonly providerName = 'myfatoorah';
  readonly providerVersion = '2.0.0';
  
  // Implementation of all IPaymentProvider methods
}
```

## طرق الدفع المدعومة

### MyFatoorah Payment Methods

| ID | Code | Name (EN) | Name (AR) | Direct Payment |
|----|------|-----------|-----------|----------------|
| 1 | KNET | KNET | كي نت | ❌ |
| 2 | VISA | VISA/MASTER | فيزا / ماستر | ❌ |
| 3 | AMEX | AMEX | اميكس | ❌ |
| 4 | BENEFIT | Benefit | بنفت | ❌ |
| 5 | MADA | MADA | مدى | ❌ |
| 6 | UAE_DEBIT | UAE Debit Cards | كروت الدفع المدينة (الامارات) | ❌ |
| 7 | QATAR_DEBIT | Qatar Debit Cards | كروت الدفع المدينة (قطر) | ❌ |
| 8 | APPLE_PAY | Apple Pay | ابل باي | ✅ |
| 9 | GOOGLE_PAY | Google Pay | جوجل باي | ✅ |
| 10 | STC_PAY | STC Pay | STC Pay | ❌ |
| 11 | OMAN_NET | Oman Net | عمان نت | ❌ |
| 12 | MOBILE_WALLET_EGYPT | Mobile Wallet (Egypt) | محفظة إلكترونية (مصر) | ❌ |
| 13 | MEEZA | Meeza | ميزة | ❌ |

**ملاحظة**: Apple Pay و Google Pay هما طرق دفع مباشرة (Direct Payment) ويتم التعامل معهما تلقائيًا من قبل MyFatoorah.

## الاستخدام

### في DonationsService

```typescript
// استخدام PaymentService (يستخدم المقدم النشط تلقائيًا)
const paymentResult = await this.paymentService.createPayment({
  amount: totalAmount,
  currency: 'KWD',
  donationId: donationId,
  description: 'Donation',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  paymentMethodId: PaymentMethodEnum.APPLE_PAY, // Apple Pay
});

// الحصول على حالة الدفعة
const status = await this.paymentService.getPaymentStatus(invoiceId, 'InvoiceId');

// الحصول على طرق الدفع المتاحة
const methods = await this.paymentService.getAvailablePaymentMethods(100, 'KWD');
```

### إضافة مقدم خدمة جديد (مثال: Stripe)

```typescript
// 1. إنشاء StripeService
@Injectable()
export class StripeService implements IPaymentProvider {
  readonly providerName = 'stripe';
  readonly providerVersion = '1.0.0';
  
  // Implementation of IPaymentProvider methods
}

// 2. تسجيله في PaymentService
constructor(
  private readonly paymentService: PaymentService,
  private readonly stripeService: StripeService,
) {
  this.paymentService.registerProvider('stripe', this.stripeService);
}

// 3. استخدامه
const result = await this.paymentService.createPayment(payload, 'stripe');
```

## الإعدادات

### Environment Variables

```env
# MyFatoorah Configuration
MYFATOORAH_API_KEY=your_api_key
MYFATOORAH_API_URL=https://apitest.myfatoorah.com
MYFATOORAH_CALLBACK_URL=https://your-domain.com/payment/success
MYFATOORAH_ERROR_URL=https://your-domain.com/payment/error
MYFATOORAH_INVOICE_TTL_MINUTES=60

# Active Payment Provider (optional, defaults to 'myfatoorah')
PAYMENT_PROVIDER=myfatoorah
```

## Webhooks

### MyFatoorah Webhook

```typescript
// POST /webhooks/myfatoorah
// أو
// POST /webhooks/:provider

@Post(':provider')
async handleWebhook(
  @Param('provider') provider: string,
  @Body() event: any,
) {
  const webhookEvent = await this.paymentService.handleWebhook(event, provider);
  // Process webhook event
}
```

## الأداء والتحسينات

1. **Lazy Loading**: يتم تحميل المقدمين عند الحاجة فقط
2. **Caching**: يمكن إضافة caching لطرق الدفع المتاحة
3. **Connection Pooling**: استخدام connection pooling للـ HTTP requests
4. **Error Handling**: معالجة أخطاء شاملة مع fallback mechanisms

## إعادة الاستخدام في مشاريع أخرى

يمكن استخدام هذا النظام في:

- **E-commerce Platforms**: متاجر إلكترونية
- **Marketplaces**: منصات بيع
- **SaaS Applications**: تطبيقات SaaS
- **Donation Platforms**: منصات التبرع (الاستخدام الحالي)

### مثال: استخدام في متجر إلكتروني

```typescript
// في OrderService
async createOrder(orderDto: CreateOrderDto) {
  const paymentResult = await this.paymentService.createPayment({
    amount: orderDto.total,
    currency: orderDto.currency,
    donationId: orderDto.orderId, // أو orderId
    description: `Order #${orderDto.orderId}`,
    customerName: orderDto.customerName,
    customerEmail: orderDto.customerEmail,
    paymentMethodId: orderDto.paymentMethodId,
  });
  
  // Save order with payment info
}
```

## الخلاصة

تم تصميم نظام الدفع ليكون:
- ✅ **مرن**: سهل إضافة مقدمي خدمة جدد
- ✅ **قابل لإعادة الاستخدام**: يعمل في أي مشروع
- ✅ **DRY**: لا يوجد تكرار في الكود
- ✅ **بسيط**: سهل الفهم والصيانة
- ✅ **محسّن**: إعدادات مثالية للأداء

