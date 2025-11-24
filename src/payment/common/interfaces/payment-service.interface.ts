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
export interface MyFatooraWebhookEvent {
  Event: number; // Enum for event type
  CreatedDate: string;
  Data: {
    InvoiceId: number;
    InvoiceStatus: number;
    InvoiceReference: string;
    CustomerReference: string;
    CreatedDate: string;
    ExpireDate: string;
    InvoiceValue: number;
    Comments: string;
    CustomerName: string;
    CustomerMobile: string;
    CustomerEmail: string;
  };

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
