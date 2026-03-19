// import { PaymentMethodEnum } from '../constants/payment.constant';

/**
 * Universal Payment Payload
 *
 * This interface is generic and can be used for any payment scenario:
 * - Donations: referenceId = donationId
 * - E-commerce: referenceId = orderId
 * - Subscriptions: referenceId = subscriptionId
 * - etc.
 */
export interface PaymentPayload {
  amount: number;
  currency: string;
  referenceId: string; // Generic reference ID (donationId, orderId, subscriptionId, etc.)
  description: string;
  customerName?: string;
  customerEmail?: string;
  mobileCountryCode?: string; // e.g. "965"
  customerMobile?: string;
  metadata?: Record<string, any>; // Additional metadata for flexibility
}

export interface MyFatoorahApiResponse<T> {
  IsSuccess: boolean;
  Message: string;
  ValidationErrors?: any[];
  Data: T;
}
export interface PaymentResult {
  id: string;
  url?: string; // URL to redirect user for payment
  status: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'paid';
  rawResponse: any;
}

export interface PaymentService {
  createPayment(payload: PaymentPayload): Promise<PaymentResult>;
  initiatePayment?(
    invoiceAmount: number,
    currencyIso: string,
  ): Promise<MyFatoorahInitiatePaymentData>;
}

/**
 * Payment method information from MyFatoorah InitiatePayment API
 */
export interface MyFatoorahPaymentMethod {
  PaymentMethodId: number;
  PaymentMethodCode: string;
  PaymentMethodEn: string;
  PaymentMethodAr: string;
  IsDirectPayment: boolean;
  ServiceCharge: number;
  TotalAmount: number;
  CurrencyIso: string;
  ImageUrl?: string;
  CurrencyId?: number;
  PaymentCurrencyCode?: string;
  PaymentCurrencyEn?: string;
  PaymentCurrencyAr?: string;
  MinLimit?: number;
  MaxLimit?: number;
}

/**
 * Response data from InitiatePayment endpoint
 */
export interface MyFatoorahInitiatePaymentData {
  PaymentMethods: MyFatoorahPaymentMethod[];
}

// Specific types for webhook events to improve type safety
// Supports both MyFatoorah Webhook V1 (legacy) and V2 (current) formats

/**
 * MyFatoorah Webhook V2 Event format (current official format)
 * Reference: https://docs.myfatoorah.com/docs/get-started
 */
export interface MyFatooraWebhookEvent {
  // ── V2 Format (current official) ──
  Event?: {
    Code: number; // 1 = PAYMENT_STATUS_CHANGED
    Name: string; // "PAYMENT_STATUS_CHANGED"
    CountryIsoCode?: string;
    CreationDate?: string;
    Reference?: string;
  };
  Data?: {
    // V2 nested structure
    Invoice?: {
      Id: string;
      Status: string; // "PAID" | "PENDING"
      Reference?: string;
      CreationDate?: string;
      ExpirationDate?: string;
      UserDefinedField?: string;
      ExternalIdentifier?: string;
      MetaData?: Record<string, string>;
    };
    Transaction?: {
      Id: string;
      Status: string; // "SUCCESS" | "FAILED" | "AUTHORIZE" | "CANCELED"
      PaymentMethod?: string;
      PaymentId: string;
      ReferenceId?: string;
      TrackId?: string;
      AuthorizationId?: string;
      TransactionDate?: string;
      ECI?: string;
      IP?: { Address?: string; Country?: string };
      Error?: { Code?: string; Message?: string };
      Card?: {
        NameOnCard?: string;
        Number?: string;
        Token?: string;
        PanHash?: string;
        ExpiryMonth?: string;
        ExpiryYear?: string;
        Brand?: string;
        Issuer?: string;
        IssuerCountry?: string;
        FundingMethod?: string;
      };
    };
    Customer?: {
      Name?: string;
      Mobile?: string;
      Email?: string;
    };
    Amount?: {
      BaseCurrency?: string;
      ValueInBaseCurrency?: string;
      ServiceCharge?: string;
      ServiceChargeVAT?: string;
      ReceivableAmount?: string;
      DisplayCurrency?: string;
      ValueInDisplayCurrency?: string;
      PayCurrency?: string;
      ValueInPayCurrency?: string;
    };
    Suppliers?: Array<{
      Code?: number;
      Name?: string;
      InvoiceShare?: string;
      ProposedShare?: string;
      DepositShare?: string;
    }>;

    // ── V1 Legacy flat fields (backward compatibility) ──
    InvoiceId?: number;
    InvoiceStatus?: number;
    InvoiceReference?: string;
    CustomerReference?: string;
    CreatedDate?: string;
    ExpireDate?: string;
    InvoiceValue?: number;
    Comments?: string;
    CustomerName?: string;
    CustomerMobile?: string;
    CustomerEmail?: string;
    Payments?: Array<{
      PaymentId?: string;
      PaymentMethodId?: number;
      PaymentMethod?: string;
      PaymentStatus?: string;
      PaymentDate?: string;
      PaymentCurrencyIso?: string;
    }>;
  };

  // ── V1 Legacy top-level fields ──
  InvoiceId?: number;
  TransactionStatus?: string;
}

export interface MyFatoorahResponseData {
  InvoiceId: string;
  InvoiceURL: string;
  [key: string]: any;
}

export interface MyFatoorahGetPaymentStatusData {
  InvoiceId: number;
  InvoiceStatus: 0 | 1 | 2 | 3 | 4 | 5;
  InvoiceReference?: string;
  CustomerReference?: string;
  CreatedDate: string;
  ExpireDate: string;
  InvoiceValue: number;
  Comments?: string;
  CustomerName?: string;
  CustomerMobile?: string;
  CustomerEmail?: string;
  UserDefinedField?: string;

  Payments: Array<{
    PaymentId: string;
    PaymentGateway: string;
    PaymentMethodId: number;
    PaymentMethod: string;
    PaymentCurrencyIso: string;
    PaymentValue: number;
    PaymentStatus: string;
    PaymentDate: string;
    Error?: string;
    PaidCurrencyValue?: number;
    PaidCurrencyExchangeRate?: number;
  }>;
}
export interface MyFatoorahGetPaymentStatusResponse {
  InvoiceId: number;
  InvoiceStatus: 0 | 1 | 2 | 3 | 4 | 5;
  InvoiceReference?: string;
  CustomerReference?: string;
  CreatedDate: string;
  ExpireDate: string;
  InvoiceValue: number;
  Comments?: string;
  CustomerName?: string;
  CustomerMobile?: string;
  CustomerEmail?: string;

  Payments: Array<{
    PaymentId: string;
    PaymentGateway: string;
    PaymentMethodId: number;
    PaymentMethod: string;
    PaymentCurrencyIso: string;
    PaymentValue: number;
    PaymentStatus: string;
    PaymentDate: string;
    Error?: string;
    PaidCurrencyValue?: number;
    PaidCurrencyExchangeRate?: number;
  }>;

  KnetDirectPaymentUrl?: string;
  CardDirectPaymentUrl?: string;
  RecurringId?: string;
  CustomerCivilId?: string;
}
