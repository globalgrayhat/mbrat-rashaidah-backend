// [FIXED 2025-06-04]
import type { AxiosResponse } from 'axios';

export interface MyFatooraConfig {
  apiKey: string;
  baseUrl: string;
  successUrl: string;
  errorUrl: string;
  webhookSecret: string;
}

export interface MyFatooraSendPaymentPayload {
  CustomerName: string;
  NotificationOption: 'Lnk';
  InvoiceValue: number;
  DisplayCurrencyIso: string;
  CustomerMobile: string;
  CustomerEmail: string;
  CallBackUrl: string;
  ErrorUrl: string;
  Language: string;
  CustomerReference: string;
  SourceInfo: string;
}

export interface MyFatooraSendPaymentResponse {
  IsSuccess: boolean;
  Message: string;
  ValidationErrors: string[] | null;
  Data: {
    InvoiceId: number;
    IsDirectPayment: boolean;
    PaymentURL: string;
    CustomerReference: string;
    UserDefinedField: string;
  } | null;
}

export interface MyFatooraPaymentStatusPayload {
  Key: number;
  KeyType: 'InvoiceId';
}

export interface MyFatooraPaymentStatusResponse {
  IsSuccess: boolean;
  Message: string;
  ValidationErrors: string[] | null;
  Data: {
    InvoiceId: number;
    InvoiceStatus: 'Paid' | 'Pending' | 'Failed' | 'Expired';
    InvoiceReference: string;
    CustomerReference: string;
    CreatedDate: string;
    ExpiryDate: string;
    InvoiceValue: number;
    Comments: string;
    CustomerName: string;
    CustomerMobile: string;
    CustomerEmail: string;
    UserDefinedField: string;
    PaymentGateway: string;
    ReferenceId: string;
    TrackId: string;
    TransactionId: string;
    PaymentId: string;
    AuthorizationId: string;
    PaidCurrency: string;
    PaidCurrencyValue: number;
    PaymentDate: string;
  } | null;
}

export interface MyFatooraWebhookData {
  InvoiceId: number;
  InvoiceStatus: 'Paid' | 'Pending' | 'Failed' | 'Expired';
  InvoiceReference: string;
  CustomerReference: string;
  CreatedDate: string;
  ExpiryDate: string;
  InvoiceValue: number;
  Comments: string;
  CustomerName: string;
  CustomerMobile: string;
  CustomerEmail: string;
  UserDefinedField: string;
  PaymentGateway: string;
  ReferenceId: string;
  TrackId: string;
  TransactionId: string;
  PaymentId: string;
  AuthorizationId: string;
  PaidCurrency: string;
  PaidCurrencyValue: number;
  PaymentDate: string;
}

export type MyFatooraApiResponse<T> = AxiosResponse<T>;
