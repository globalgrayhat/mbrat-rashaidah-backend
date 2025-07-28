import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios, {
  AxiosInstance,
  AxiosError,
  Method,
  AxiosRequestConfig,
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

@Injectable()
export class MyFatooraService implements PaymentService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly http: AxiosInstance;

  // env-driven
  private readonly invoiceTtlMinutes: number; // e.g., 10
  private readonly invoiceTz: string; // default: Asia/Kuwait
  private readonly ttlSkewSeconds: number; // default: 30

  constructor(private config: AppConfigService) {
    // API key
    const apiKey = this.config.myFatoorahApiKey;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'MyFatoorah API Key is not configured. Please check your environment variables.',
      );
    }
    this.apiKey = apiKey;

    // TTL (minutes)
    const ttl = Number(this.config.myFatoorahInvoiceTtlMinutes);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new InternalServerErrorException(
        'MyFatoorah Invoice TTL is not configured or invalid. Please check your environment variables.',
      );
    }
    this.invoiceTtlMinutes = ttl;

    // Timezone & skew
    this.invoiceTz = this.config.myFatoorahTz || 'Asia/Kuwait';
    const skew = Number(this.config.myFatoorahTtlSkewSeconds ?? 30);
    this.ttlSkewSeconds = Number.isFinite(skew) && skew >= 0 ? skew : 30;

    // Normalize baseURL to always end with /v2/
    const raw = (
      this.config.myFatoorahApiUrl || 'https://apitest.myfatoorah.com'
    ).trim();
    const noTrail = raw.replace(/\/+$/, '');
    this.baseUrl = noTrail.endsWith('/v2') ? `${noTrail}/` : `${noTrail}/v2/`;

    this.http = axios.create({
      baseURL: this.baseUrl, // e.g. https://apitest.myfatoorah.com/v2/
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
    });
  }

  /** Format 'ExpiryDate' as YYYY-MM-DDTHH:mm:ss in merchant timezone (no 'Z') */
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

    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
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
    if (mobile) out.CustomerMobile = mobile; // send as-is
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
          `${operationName} failed: 'Data' field is missing from MyFatoorah response.`,
        );
      }
      return response.data.Data;
    } catch (err) {
      const axiosError = err as AxiosError;
      const errorMessage =
        (axiosError.response?.data as { Message?: string })?.Message ||
        axiosError.message;

      // keep for troubleshooting
      console.error(
        `${operationName} error:`,
        axiosError.response?.data || axiosError.message,
      );
      throw new InternalServerErrorException(
        `Failed to ${operationName}: ${errorMessage}`,
      );
    }
  }

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
      customerMobile, // optional in your interface
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
      ErrorUrl: this.config.myFatoorahErrorkUrl, // keep your existing config key
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
      'Create MyFatoorah payment via SendPayment',
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

  /** Inquiry (GetPaymentStatus) by InvoiceId or PaymentId or CustomerReference */
  async getPaymentStatus(
    key: string,
    keyType: MFKeyType = 'InvoiceId',
  ): Promise<MyFatoorahGetPaymentStatusData> {
    return this.request<MyFatoorahGetPaymentStatusData>(
      'post',
      'GetPaymentStatus',
      { Key: key, KeyType: keyType },
      'Get MyFatoorah payment status',
    );
  }
}
