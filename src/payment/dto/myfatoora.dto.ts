/**
 * DTO for initiating a payment with MyFatoorah.
 * Based on MyFatoorah API v2 documentation.
 */
export class InitiatePaymentDto {
  NotificationOption: 'LNK' | 'EML' | 'SMS'; // Send link by Link, Email, or SMS
  InvoiceValue: number;
  CurrencyIso: string;
  CallBackUrl: string;
  ErrorUrl: string;
  CustomerName: string;
  CustomerEmail?: string;
  CustomerMobile?: string;
  Language: 'AR' | 'EN';
  CustomerReference: string; // e.g., Our internal Donation ID
  UserDefinedField?: string; // To pass extra data like projectId
}

/**
 * Represents the successful data structure within a MyFatoorah API response.
 */
interface PaymentResponseData {
  InvoiceId: number;
  PaymentURL: string;
  // Add other fields if needed
}

/**
 * Represents the overall structure of the response from MyFatoorah's InitiatePayment endpoint.
 */
export class PaymentResponse {
  IsSuccess: boolean;
  Message: string;
  ValidationErrors?: any;
  Data: PaymentResponseData;
}

/**
 * Represents the overall structure of the response from MyFatoorah's MakeRefund endpoint.
 */
export class RefundResponse {
  IsSuccess: boolean;
  Message: string;
  Data?: {
    RefundId: number;
    // Add other relevant refund fields
  };
}
