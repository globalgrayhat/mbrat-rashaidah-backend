import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
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
  MyFatoorahInitiatePaymentData,
} from '../common/interfaces/payment-service.interface';
import { AppConfigService } from '../config/config.service';
import type { MFKeyType } from '../common/constants/payment.constant';
import { deriveOutcome } from '../common/utils/mf-status.util';

@Injectable()
export class MyFatooraService implements PaymentService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly http: AxiosInstance;

  private readonly invoiceTtlMinutes: number;
  private readonly invoiceTz: string;
  private readonly ttlSkewSeconds: number;

  constructor(private readonly config: AppConfigService) {
    const apiKey = this.config.myFatoorahApiKey;
    if (!apiKey)
      throw new InternalServerErrorException(
        'MyFatoorah API Key is not configured.',
      );
    this.apiKey = apiKey;

    const ttl = Number(this.config.myFatoorahInvoiceTtlMinutes);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new InternalServerErrorException(
        'MyFatoorah Invoice TTL is not configured or invalid.',
      );
    }
    this.invoiceTtlMinutes = ttl;

    this.invoiceTz = this.config.myFatoorahTz || 'Asia/Kuwait';
    const skew = Number(this.config.myFatoorahTtlSkewSeconds ?? 30);
    this.ttlSkewSeconds = Number.isFinite(skew) && skew >= 0 ? skew : 30;

    const raw = this.config.myFatoorahApiUrl.trim();
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
        ...(data !== undefined ? { data } : {}),
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
      const statusCode = axiosError.response?.status;
      const errorMessage =
        (axiosError.response?.data as { Message?: string })?.Message ||
        axiosError.message;

      console.error(
        `${operationName} error:`,
        axiosError.response?.data || axiosError.message,
      );

      // Handle specific HTTP status codes
      if (statusCode === 401) {
        throw new UnauthorizedException(
          `MyFatoorah authentication failed. Please check your API key configuration. Original error: ${errorMessage}`,
        );
      }

      if (statusCode === 403) {
        throw new UnauthorizedException(
          `MyFatoorah access forbidden. Please verify your API permissions. Original error: ${errorMessage}`,
        );
      }

      if (statusCode === 404) {
        throw new BadRequestException(
          `MyFatoorah endpoint not found. Please verify the API URL configuration. Original error: ${errorMessage}`,
        );
      }

      // For other errors, throw InternalServerErrorException
      throw new InternalServerErrorException(
        `Failed to ${operationName}: ${errorMessage}`,
      );
    }
  }

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

  /** Unified status snapshot */
  async getPaymentStatus(
    key: string,
    keyType: MFKeyType = 'InvoiceId',
  ): Promise<{
    outcome: 'paid' | 'failed' | 'pending';
    invoiceId: string;
    raw: MyFatoorahGetPaymentStatusData;
  }> {
    if (!key) throw new BadRequestException('Key is required.');
    const data = await this.request<MyFatoorahGetPaymentStatusData>(
      'post',
      'GetPaymentStatus',
      { Key: key, KeyType: keyType },
      'Get MyFatoorah payment status',
    );

    const paymentStatuses = data.Payments?.map((p) => p?.PaymentStatus) ?? [];

    return {
      invoiceId: String(data.InvoiceId),
      outcome: deriveOutcome(data.InvoiceStatus as unknown, paymentStatuses),
      raw: data,
    };
  }

  async getPaymentStatusByPaymentId(paymentId: string) {
    return this.getPaymentStatus(paymentId, 'PaymentId');
  }

  /**
   * InitiatePayment endpoint - Get available payment methods with service charges
   * Reference: https://docs.myfatoorah.com/docs/gateway-integration#initiate-payment
   */
  async initiatePayment(
    invoiceAmount: number,
    currencyIso: string,
  ): Promise<MyFatoorahInitiatePaymentData> {
    if (!invoiceAmount || invoiceAmount <= 0) {
      throw new BadRequestException('InvoiceAmount must be greater than 0');
    }
    if (!currencyIso || currencyIso.length !== 3) {
      throw new BadRequestException(
        'CurrencyIso must be a valid 3-letter ISO code',
      );
    }

    const requestBody = {
      InvoiceAmount: invoiceAmount,
      CurrencyIso: currencyIso,
    };

    const data = await this.request<MyFatoorahInitiatePaymentData>(
      'post',
      'InitiatePayment',
      requestBody,
      'Initiate MyFatoorah payment',
    );

    if (!data.PaymentMethods || !Array.isArray(data.PaymentMethods)) {
      throw new InternalServerErrorException(
        'InitiatePayment failed: Missing or invalid PaymentMethods array.',
      );
    }

    return data;
  }
}
