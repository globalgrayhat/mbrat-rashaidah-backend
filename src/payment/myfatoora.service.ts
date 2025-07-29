/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  Method,
} from 'axios';
import {
  PaymentPayload,
  PaymentResult,
  PaymentService,
  MyFatoorahResponseData,
  MyFatoorahGetPaymentStatusData,
} from '../common/interfaces/payment-service.interface';
import { AppConfigService } from '../config/config.service';
import type { MFKeyType } from '../common/constants/payment.constant';

// ------------------------------------------------------------
// MyFatoorah canonical enums (strings, not mysterious numbers!)
// ------------------------------------------------------------

export enum MFInvoiceStatus {
  Pending = 'Pending',
  Paid = 'Paid',
  Canceled = 'Canceled',
}

export enum MFTransactionStatus {
  InProgress = 'InProgress',
  Succss = 'Succss',
  Failed = 'Failed',
  Canceled = 'Canceled',
  Authorize = 'Authorize',
}

// ------------------------------------------------------------
// Helper: normalize MF response → unified outcome
// ------------------------------------------------------------
export function mapMfOutcome(
  invoiceStatus?: MFInvoiceStatus,
  txStatuses: MFTransactionStatus[] = [],
): 'paid' | 'failed' | 'pending' {
  if (
    invoiceStatus === MFInvoiceStatus.Paid ||
    txStatuses.includes(MFTransactionStatus.Succss)
  ) {
    return 'paid';
  }
  if (
    invoiceStatus === MFInvoiceStatus.Canceled ||
    (txStatuses.length > 0 &&
      txStatuses.every((s) =>
        [MFTransactionStatus.Failed, MFTransactionStatus.Canceled].includes(s),
      ))
  ) {
    return 'failed';
  }
  return 'pending';
}

@Injectable()
export class MyFatooraService implements PaymentService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly http: AxiosInstance;

  private readonly invoiceTtlMinutes: number;
  private readonly invoiceTz: string;
  private readonly ttlSkewSeconds: number;

  constructor(private readonly config: AppConfigService) {
    // ------------------------------ API key ------------------------------
    const apiKey = this.config.myFatoorahApiKey;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'MyFatoorah API Key is not configured.',
      );
    }
    this.apiKey = apiKey;

    // ------------------------------ Invoice TTL ------------------------------
    const ttl = Number(this.config.myFatoorahInvoiceTtlMinutes);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new InternalServerErrorException(
        'MyFatoorah Invoice TTL is not configured or invalid.',
      );
    }
    this.invoiceTtlMinutes = ttl;

    // ------------------------------ Timezone & skew ------------------------------
    this.invoiceTz = this.config.myFatoorahTz || 'Asia/Kuwait';
    const skew = Number(this.config.myFatoorahTtlSkewSeconds ?? 30);
    this.ttlSkewSeconds = Number.isFinite(skew) && skew >= 0 ? skew : 30;

    // ------------------------------ Base URL ------------------------------
    const raw = (
      this.config.myFatoorahApiUrl || 'https://apitest.myfatoorah.com'
    ).trim();
    const noTrail = raw.replace(/\/+$/, '');
    this.baseUrl = noTrail.endsWith('/v2') ? `${noTrail}/` : `${noTrail}/v2/`;

    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
    });
  }

  // ------------------------------------------------------------
  // Utils
  // ------------------------------------------------------------

  /** Format MyFatoorah ExpiryDate (YYYY-MM-DDTHH:mm:ss) in merchant TZ */
  private formatMFExpiry(minutesFromNow: number, tz: string): string {
    const target = new Date(
      Date.now() + minutesFromNow * 60_000 + this.ttlSkewSeconds * 1_000,
    );
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(target);

    const get = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === t)?.value ?? '00';

    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get(
      'minute',
    )}:${get('second')}`;
  }

  /** Add optional customer fields only when provided */
  private buildCustomerExtras(
    name?: string,
    email?: string,
    mobile?: string,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (name) out.CustomerName = name;
    if (email) out.CustomerEmail = email;
    if (mobile) out.CustomerMobile = mobile;
    return out;
  }

  /** Small axios wrapper with consistent error handling */
  private async request<T>(
    method: Method,
    url: string,
    data?: unknown,
    operationName = 'MyFatoorah API call',
  ): Promise<T> {
    try {
      const config: AxiosRequestConfig = {
        method,
        url,
        ...(typeof data !== 'undefined' ? { data } : {}),
      };

      const response = await this.http.request<{
        IsSuccess: boolean;
        Message: string;
        ValidationErrors?: unknown[];
        Data: T;
      }>(config);

      if (!response.data?.IsSuccess) {
        throw new InternalServerErrorException(
          `${operationName} failed: ${response.data?.Message}`,
        );
      }
      if (response.data?.Data == null) {
        throw new InternalServerErrorException(
          `${operationName} failed: 'Data' field missing from MyFatoorah response.`,
        );
      }
      return response.data.Data;
    } catch (err) {
      const axiosError = err as AxiosError;
      const errorMessage =
        (axiosError.response?.data as { Message?: string })?.Message ||
        axiosError.message;

      console.error(
        `${operationName} error:`,
        axiosError.response?.data || axiosError.message,
      );
      throw new InternalServerErrorException(
        `Failed to ${operationName}: ${errorMessage}`,
      );
    }
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------

  /** Create invoice (SendPayment) */
  async createPayment(
    payload: PaymentPayload & { paymentMethodId?: number },
  ): Promise<PaymentResult> {
    const {
      amount,
      currency,
      donationId,
      description,
      customerName,
      customerEmail,
      customerMobile,
      paymentMethodId,
    } = payload;

    const ExpiryDate = this.formatMFExpiry(
      this.invoiceTtlMinutes,
      this.invoiceTz,
    );

    const requestBody = {
      ...(paymentMethodId && { InvoicePaymentMethods: [paymentMethodId] }),
      NotificationOption: 'LNK',
      InvoiceValue: amount,
      CallBackUrl: this.config.myFatoorahCallbackUrl,
      ErrorUrl: this.config.myFatoorahErrorkUrl,
      Language: 'AR',
      CurrencyIso: currency,
      Description: description,
      ClientReferenceId: donationId,
      ExpiryDate,
      ...this.buildCustomerExtras(customerName, customerEmail, customerMobile),
    };

    const data = await this.request<MyFatoorahResponseData>(
      'post',
      'SendPayment',
      requestBody,
      'Create MyFatoorah payment',
    );

    if (!data.InvoiceURL || !data.InvoiceId) {
      throw new InternalServerErrorException(
        'Payment initiation failed: Missing InvoiceURL or InvoiceId.',
      );
    }

    return {
      id: data.InvoiceId.toString(),
      url: data.InvoiceURL,
      status: 'pending',
      rawResponse: data,
    };
  }

  /** Preferred: Inquire by **PaymentId** (أدق وأسرع) */
  async getPaymentStatusByPaymentId(paymentId: string): Promise<{
    outcome: 'paid' | 'failed' | 'pending';
    invoiceId: string;
    raw: MyFatoorahGetPaymentStatusData;
  }> {
    if (!paymentId) throw new BadRequestException('PaymentId is required.');

    const data = await this.request<MyFatoorahGetPaymentStatusData>(
      'post',
      'GetPaymentStatus',
      { Key: paymentId, KeyType: 'PaymentId' },
      'Get MyFatoorah payment status',
    );

    const invoiceStatus = data.InvoiceStatus as unknown as MFInvoiceStatus;
    const txStatuses =
      data.Payments?.map(
        (p) => p.PaymentStatus as unknown as MFTransactionStatus,
      ) ?? [];

    return {
      invoiceId: data.InvoiceId.toString(),
      outcome: mapMfOutcome(invoiceStatus, txStatuses),
      raw: data,
    };
  }

  /** Fallback: Inquire by InvoiceId or CustomerReference */
  async getPaymentStatus(
    key: string,
    keyType: MFKeyType = 'InvoiceId',
  ): Promise<{
    outcome: 'paid' | 'failed' | 'pending';
    invoiceId: string;
    raw: MyFatoorahGetPaymentStatusData;
  }> {
    const data = await this.request<MyFatoorahGetPaymentStatusData>(
      'post',
      'GetPaymentStatus',
      { Key: key, KeyType: keyType },
      'Get MyFatoorah payment status',
    );

    const invoiceStatus = data.InvoiceStatus as unknown as MFInvoiceStatus;
    const txStatuses =
      data.Payments?.map(
        (p) => p.PaymentStatus as unknown as MFTransactionStatus,
      ) ?? [];

    return {
      invoiceId: data.InvoiceId.toString(),
      outcome: mapMfOutcome(invoiceStatus, txStatuses),
      raw: data,
    };
  }
}
