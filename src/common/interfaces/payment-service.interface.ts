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
  Data: T; // The actual data returned by the API
}
export interface PaymentResult {
  id: string; // Payment gateway's transaction ID (e.g., Stripe Checkout Session ID, MyFatoorah InvoiceId)
  url?: string; // URL to redirect user for payment
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  rawResponse: any; // Raw response from the payment gateway
}

export interface PaymentService {
  createPayment(payload: PaymentPayload): Promise<PaymentResult>;
  // Potentially add more methods like:
  // refundPayment(transactionId: string, amount: number): Promise<any>;
  // getPaymentStatus(transactionId: string): Promise<PaymentStatus>;
}

// Specific types for webhook events to improve type safety
export interface MyFatooraWebhookEvent {
  Event: number; // Enum for event type
  CreatedDate: string;
  Data: {
    InvoiceId: number;
    InvoiceStatus: number; // 1: Failed, 2: Expired, 3: Canceled, 4: Paid, 5: NotPaid
    InvoiceReference: string; // Your ClientReferenceId
    CustomerReference: string;
    CreatedDate: string;
    ExpireDate: string;
    InvoiceValue: number;
    Comments: string;
    CustomerName: string;
    CustomerMobile: string;
    CustomerEmail: string;
    // ... other fields as per MyFatoorah webhook documentation
    // Note: The structure can vary based on the MyFatoorah webhook configuration (Callback URL vs. Invoice Status Callback)
    // You might also get direct transaction details here if it's the simple Callback URL.
  };
  // Some MyFatoora webhooks send data directly, not nested under a 'Data' property
  InvoiceId?: number;
  TransactionStatus?: string; // 'SUCCESS', 'FAILED', 'PENDING'
  // etc.
}

export interface MyFatoorahResponseData {
  InvoiceId: string;
  PaymentURL: string;
  [key: string]: any; // Optional fallback
}

export interface MyFatoorahGetPaymentStatusData {
  // Consistent naming with MyFatoorahResponseData
  InvoiceId: number;
  InvoiceStatus: 0 | 1 | 2 | 3 | 4 | 5; // 0-Initiated, 1-Failed, 2-Expired, 3-Canceled, 4-Paid, 5-NotPaid
  InvoiceReference?: string; // ClientReferenceId you sent
  CustomerReference?: string;
  CreatedDate: string; // e.g., "2024-07-25T10:30:00"
  ExpireDate: string; // e.g., "2024-07-25T11:00:00"
  InvoiceValue: number;
  Comments?: string;
  CustomerName?: string;
  CustomerMobile?: string;
  CustomerEmail?: string;
  // More detailed payment and transaction information can be nested here:
  Payments: Array<{
    PaymentId: string; // Unique ID for this specific payment attempt/transaction
    PaymentGateway: string; // e.g., "KNET", "Visa", "MasterCard"
    PaymentMethodId: number;
    PaymentMethod: string;
    PaymentCurrencyIso: string;
    PaymentValue: number;
    PaymentStatus: string; // e.g., "SUCCESS", "FAILED"
    PaymentDate: string;
    Error?: string;
    PaidCurrencyValue?: number;
    PaidCurrencyExchangeRate?: number;
    // ... potentially more fields related to the specific payment
  }>;
  // Other potential fields based on advanced features or specific configurations:
  // KnetDirectPaymentUrl?: string;
  // CardDirectPaymentUrl?: string;
  // RecurringId?: string;
  // CustomerCivilId?: string;
  // ... and other optional fields
}
export interface MyFatoorahGetPaymentStatusResponse {
  InvoiceId: number;
  InvoiceStatus: 0 | 1 | 2 | 3 | 4 | 5; // 0-Initiated, 1-Failed, 2-Expired, 3-Canceled, 4-Paid, 5-NotPaid
  InvoiceReference?: string; // ClientReferenceId you sent
  CustomerReference?: string;
  CreatedDate: string; // e.g., "2024-07-25T10:30:00"
  ExpireDate: string; // e.g., "2024-07-25T11:00:00"
  InvoiceValue: number;
  Comments?: string;
  CustomerName?: string;
  CustomerMobile?: string;
  CustomerEmail?: string;
  // More detailed payment and transaction information can be nested here:
  Payments: Array<{
    PaymentId: string; // Unique ID for this specific payment attempt/transaction
    PaymentGateway: string; // e.g., "KNET", "Visa", "MasterCard"
    PaymentMethodId: number;
    PaymentMethod: string;
    PaymentCurrencyIso: string;
    PaymentValue: number;
    PaymentStatus: string; // e.g., "SUCCESS", "FAILED"
    PaymentDate: string;
    Error?: string;
    PaidCurrencyValue?: number;
    PaidCurrencyExchangeRate?: number;
    // ... potentially more fields related to the specific payment
  }>;
  // Other potential fields based on advanced features or specific configurations:
  KnetDirectPaymentUrl?: string;
  CardDirectPaymentUrl?: string;
  RecurringId?: string;
  CustomerCivilId?: string;
  // ... and other optional fields
}
