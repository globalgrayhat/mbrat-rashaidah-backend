// import { PaymentMethodEnum } from '../constants/payment.constant';

export interface PaymentPayload {
  amount: number;
  currency: string;
  donationId: string; // Our internal donation ID
  description: string;
  customerName?: string;
  customerEmail?: string;
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
  PaymentURL: string;
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
