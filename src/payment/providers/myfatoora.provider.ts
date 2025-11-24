/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */
/**
 * MyFatoorah Payment Provider Implementation
 *
 * This service is completely portable and can be used in any project.
 * It implements IPaymentProvider interface and can work with or without
 * a specific config service implementation.
 *
 * Features:
 * - Portable: No dependencies on project-specific logic
 * - Flexible: Can be configured via interface or direct values
 * - Supports all MyFatoorah payment methods
 * - Implements IPaymentProvider for universal compatibility
 *
 * Usage:
 * ```typescript
 * // Option 1: With config service
 * const service = new MyFatooraService(configService);
 *
 * // Option 2: With direct config
 * const service = new MyFatooraService({
 *   apiKey: 'your-key',
 *   callbackUrl: 'https://...',
 *   errorUrl: 'https://...',
 * });
 * ```
 */
import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Optional,
  OnModuleDestroy,
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
import {
  IPaymentProvider,
  PaymentStatusResult,
  AvailablePaymentMethodsResponse,
  PaymentWebhookEvent,
  ProviderPaymentMethod,
  ProviderHealthCheckResult,
} from '../common/interfaces/payment-provider.interface';
import type { MFKeyType } from '../common/constants/payment.constant';
import { deriveOutcome } from '../common/utils/mf-status.util';
import { PAYMENT_METHOD_INFO } from '../common/constants/payment.constant';
import {
  IMyFatoorahConfig,
  DEFAULT_MYFATOORAH_CONFIG,
} from '../common/configs/myfatoorah-config.interface';

/**
 * Adapter for AppConfigService to IMyFatoorahConfig
 * This allows backward compatibility with existing AppConfigService
 */
export interface IMyFatoorahConfigAdapter {
  myFatoorahApiKey: string;
  myFatoorahApiUrl?: string;
  myFatoorahCallbackUrl?: string;
  myFatoorahErrorkUrl?: string;
  myFatoorahInvoiceTtlMinutes?: number;
  myFatoorahTz?: string;
  myFatoorahTtlSkewSeconds?: number;
}

@Injectable()
export class MyFatooraService
  implements PaymentService, IPaymentProvider, OnModuleDestroy
{
  readonly providerName = 'myfatoorah';
  readonly providerVersion = '2.0.0';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly http: AxiosInstance;
  private readonly invoiceTtlMinutes: number;
  private readonly invoiceTz: string;
  private readonly ttlSkewSeconds: number;
  private readonly callbackUrl?: string;
  private readonly errorUrl?: string;

  /**
   * Constructor accepts either:
   * 1. IMyFatoorahConfig object (portable)
   * 2. IMyFatoorahConfigAdapter (for AppConfigService compatibility)
   */
  constructor(
    @Optional()
    config?: IMyFatoorahConfig | IMyFatoorahConfigAdapter,
  ) {
    // Normalize config to IMyFatoorahConfig format
    const normalizedConfig = this.normalizeConfig(config);

    // Validate required fields only if config is provided
    // If no config provided, service will be marked as not configured
    if (config && !normalizedConfig.apiKey) {
      throw new InternalServerErrorException(
        'MyFatoorah API Key is required. Please provide apiKey in configuration.',
      );
    }

    // Set API key (may be empty if not configured - service will be marked as not configured)
    this.apiKey = normalizedConfig.apiKey || '';
    this.callbackUrl = normalizedConfig.callbackUrl;
    this.errorUrl = normalizedConfig.errorUrl;

    // Set invoice TTL
    const ttl =
      normalizedConfig.invoiceTtlMinutes ??
      DEFAULT_MYFATOORAH_CONFIG.invoiceTtlMinutes ??
      60;
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new InternalServerErrorException(
        'MyFatoorah Invoice TTL must be a positive number.',
      );
    }
    this.invoiceTtlMinutes = ttl;

    // Set timezone
    this.invoiceTz =
      normalizedConfig.timezone ??
      DEFAULT_MYFATOORAH_CONFIG.timezone ??
      'Asia/Kuwait';

    // Set TTL skew
    const skew =
      normalizedConfig.ttlSkewSeconds ??
      DEFAULT_MYFATOORAH_CONFIG.ttlSkewSeconds ??
      30;
    this.ttlSkewSeconds = Number.isFinite(skew) && skew >= 0 ? skew : 30;

    // Set base URL
    const rawUrl =
      normalizedConfig.apiUrl ?? DEFAULT_MYFATOORAH_CONFIG.apiUrl ?? '';
    const trimmed = rawUrl.trim();
    const noTrail = trimmed.replace(/\/+$/, '');
    this.baseUrl = noTrail.endsWith('/v2') ? `${noTrail}/` : `${noTrail}/v2/`;

    // Initialize HTTP client with optimized configuration for memory management
    const http = require('http');
    const https = require('https');
    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      // Memory optimization: Connection pooling and timeouts
      timeout: 30000, // 30 seconds timeout
      httpAgent: new http.Agent({
        keepAlive: true, // Reuse connections
        keepAliveMsecs: 1000, // Keep connections alive for 1 second
        maxSockets: 50, // Maximum number of sockets per host
        maxFreeSockets: 10, // Maximum number of free sockets
        timeout: 30000, // Socket timeout
      }),
      httpsAgent: new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 30000,
      }),
    });
  }

  /**
   * Normalize config from different sources to IMyFatoorahConfig
   */
  private normalizeConfig(
    config?: IMyFatoorahConfig | IMyFatoorahConfigAdapter,
  ): IMyFatoorahConfig {
    if (!config) {
      // Try to get from environment variables as fallback
      return {
        apiKey: process.env.MYFATOORAH_API_KEY || '',
        apiUrl: process.env.MYFATOORAH_API_URL,
        callbackUrl: process.env.MYFATOORAH_CALLBACK_URL,
        errorUrl: process.env.MYFATOORAH_ERROR_URL,
        invoiceTtlMinutes: process.env.MYFATOORAH_INVOICE_TTL_MINUTES
          ? Number(process.env.MYFATOORAH_INVOICE_TTL_MINUTES)
          : undefined,
        timezone: process.env.MYFATOORAH_TZ,
        ttlSkewSeconds: process.env.MYFATOORAH_TTL_SKEW_SECONDS
          ? Number(process.env.MYFATOORAH_TTL_SKEW_SECONDS)
          : undefined,
      };
    }

    // Check if it's an adapter (AppConfigService style)
    if ('myFatoorahApiKey' in config) {
      const adapter = config;
      return {
        apiKey: adapter.myFatoorahApiKey,
        apiUrl: adapter.myFatoorahApiUrl,
        callbackUrl: adapter.myFatoorahCallbackUrl,
        errorUrl: adapter.myFatoorahErrorkUrl,
        invoiceTtlMinutes: adapter.myFatoorahInvoiceTtlMinutes
          ? Number(adapter.myFatoorahInvoiceTtlMinutes)
          : undefined,
        timezone: adapter.myFatoorahTz,
        ttlSkewSeconds: adapter.myFatoorahTtlSkewSeconds
          ? Number(adapter.myFatoorahTtlSkewSeconds)
          : undefined,
      };
    }

    // Already in IMyFatoorahConfig format
    return config;
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
        const errorMessage = response.data?.Message || 'Unknown error';

        // Handle "No data match" as NotFoundException
        if (
          errorMessage.toLowerCase().includes('no data match') ||
          errorMessage.toLowerCase().includes('not found') ||
          errorMessage.toLowerCase().includes('does not exist')
        ) {
          throw new NotFoundException(
            `Payment not found in MyFatoorah: ${errorMessage}`,
          );
        }

        throw new BadRequestException(
          `${operationName} failed: ${errorMessage}`,
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
      referenceId, // Generic reference ID (donationId, orderId, etc.)
      description,
      customerName,
      customerEmail,
      customerMobile,
      paymentMethodId,
    } = payload;

    // Validate callback URLs if not provided in config
    if (!this.callbackUrl) {
      throw new BadRequestException(
        'Callback URL is required. Please configure myFatoorahCallbackUrl.',
      );
    }
    if (!this.errorUrl) {
      throw new BadRequestException(
        'Error URL is required. Please configure myFatoorahErrorUrl.',
      );
    }

    const ExpiryDate = this.formatMFExpiry(
      this.invoiceTtlMinutes,
      this.invoiceTz,
    );

    const requestBody = {
      ...(paymentMethodId && { InvoicePaymentMethods: [paymentMethodId] }),
      NotificationOption: 'LNK',
      InvoiceValue: amount,
      CallBackUrl: this.callbackUrl,
      ErrorUrl: this.errorUrl,
      Language: 'AR',
      CurrencyIso: currency,
      Description: description,
      ClientReferenceId: referenceId, // Generic referenceId
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

  /**
   * Unified status snapshot (Internal method)
   */
  private async getPaymentStatusInternal(
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

    // Note: ExpiryDate check is handled at PaymentService level
    // This keeps provider logic clean and independent

    const paymentStatuses = data.Payments?.map((p) => p?.PaymentStatus) ?? [];

    return {
      invoiceId: String(data.InvoiceId),
      outcome: deriveOutcome(data.InvoiceStatus as unknown, paymentStatuses),
      raw: data,
    };
  }

  async getPaymentStatusByPaymentId(paymentId: string) {
    return this.getPaymentStatusInternal(paymentId, 'PaymentId');
  }

  // ==================== IPaymentProvider Implementation ====================

  isConfigured(): boolean {
    try {
      return !!(
        this.apiKey &&
        this.baseUrl &&
        this.invoiceTtlMinutes > 0 &&
        this.callbackUrl &&
        this.errorUrl
      );
    } catch {
      return false;
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatusResult> {
    // MyFatoorah supports both InvoiceId and PaymentId lookup
    // Try InvoiceId first (most common), then PaymentId if needed
    // Note: ExpiryDate check is handled at PaymentService level
    let result;
    try {
      result = await this.getPaymentStatusInternal(transactionId, 'InvoiceId');
    } catch (error) {
      // If InvoiceId fails, try PaymentId
      if (error instanceof NotFoundException) {
        result = await this.getPaymentStatusInternal(
          transactionId,
          'PaymentId',
        );
      } else {
        throw error;
      }
    }

    return {
      outcome: result.outcome,
      transactionId: result.invoiceId,
      paymentId: result.raw?.Payments?.[0]?.PaymentId,
      amount: result.raw?.InvoiceValue,
      currency: result.raw?.Payments?.[0]?.PaymentCurrencyIso,
      raw: result.raw,
    };
  }

  async getAvailablePaymentMethods(
    invoiceAmount: number,
    currencyIso: string,
  ): Promise<AvailablePaymentMethodsResponse> {
    try {
      const data = await this.initiatePayment(invoiceAmount, currencyIso);

      // Use payment methods directly from MyFatoorah response
      // No need to map to local PaymentMethodEnum - use provider's data as-is
      // This makes the system flexible and provider-agnostic
      const paymentMethods: ProviderPaymentMethod[] = data.PaymentMethods.map(
        (method) => {
          return {
            id: method.PaymentMethodId, // Use provider's ID directly
            code: method.PaymentMethodCode, // Use provider's code directly
            nameEn: method.PaymentMethodEn, // Use provider's English name
            nameAr: method.PaymentMethodAr, // Use provider's Arabic name
            isDirectPayment: method.IsDirectPayment, // Use provider's flag
            serviceCharge: method.ServiceCharge, // Use provider's service charge
            totalAmount: method.TotalAmount, // Use provider's total amount
            currency: method.CurrencyIso, // Use provider's currency
            imageUrl: method.ImageUrl, // Use provider's image URL
            minLimit: method.MinLimit, // Use provider's min limit
            maxLimit: method.MaxLimit, // Use provider's max limit
          };
        },
      );

      return {
        success: true,
        paymentMethods,
        invoiceAmount,
        currency: currencyIso,
        timestamp: new Date().toISOString(),
      };
    } catch {
      // Fallback to static payment methods
      const fallbackMethods: ProviderPaymentMethod[] = Object.values(
        PAYMENT_METHOD_INFO,
      ).map((info) => ({
        id: info.id,
        code: info.code,
        nameEn: info.nameEn,
        nameAr: info.nameAr,
        isDirectPayment: info.isDirectPayment,
        serviceCharge: 0,
        totalAmount: invoiceAmount,
        currency: currencyIso,
        imageUrl: info.imageUrl,
        note: 'Service charges not available. MyFatoorah API is not configured or unavailable.',
      }));

      return {
        success: true,
        paymentMethods: fallbackMethods,
        invoiceAmount,
        currency: currencyIso,
        timestamp: new Date().toISOString(),
        fallback: true,
        message:
          'Payment methods retrieved from static list. MyFatoorah API is not available.',
      };
    }
  }

  async handleWebhook(webhookData: any): Promise<PaymentWebhookEvent> {
    interface MyFatoorahWebhookData {
      Event: number;
      CreatedDate: string;
      Data: {
        InvoiceId: number;
        InvoiceStatus: number;
        CustomerName: string;
        CustomerEmail: string;
        CustomerMobile: string;
        InvoiceValue: number;
        CurrencyIso?: string;
      };
    }

    const event = webhookData as MyFatoorahWebhookData;

    const statusMap: Record<
      number,
      'paid' | 'failed' | 'pending' | 'canceled'
    > = {
      0: 'pending',
      1: 'failed',
      2: 'failed',
      3: 'failed',
      4: 'paid',
      5: 'paid',
    };

    return {
      eventType: event.Event,
      transactionId: String(event.Data.InvoiceId),
      status: statusMap[event.Data.InvoiceStatus] || 'pending',
      amount: event.Data.InvoiceValue,
      currency: event.Data.CurrencyIso || 'KWD',
      customerInfo: {
        name: event.Data.CustomerName,
        email: event.Data.CustomerEmail,
        mobile: event.Data.CustomerMobile,
      },
      rawData: webhookData,
      timestamp: event.CreatedDate || new Date().toISOString(),
    };
  }

  async validateWebhook(webhookData: any): Promise<boolean> {
    return Promise.resolve(
      !!(
        (webhookData as { Event?: number })?.Event !== undefined &&
        (webhookData as { Data?: { InvoiceId?: number } })?.Data?.InvoiceId !==
          undefined
      ),
    );
  }

  /**
   * InitiatePayment endpoint - Get available payment methods with service charges
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

  /**
   * Test connection to MyFatoorah API
   * Performs a lightweight API call to verify the provider is working
   * @returns Health check result with status and details
   */
  async healthCheck(): Promise<ProviderHealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Check if provider is configured
    if (!this.isConfigured()) {
      return {
        provider: this.providerName,
        status: 'not_configured',
        configured: false,
        message:
          'MyFatoorah is not configured. Please set MYFATOORAH_API_KEY and other required environment variables.',
        timestamp,
      };
    }

    try {
      // Perform a lightweight API call to test connection
      // Using GetPaymentStatus with a non-existent ID is lightweight
      // We expect a "not found" error, which confirms the API is reachable
      await this.request(
        'post',
        'GetPaymentStatus',
        { Key: '00000000-0000-0000-0000-000000000000', KeyType: 'InvoiceId' },
        'Health check',
      );

      // If we get here, API responded (even if with error)
      const responseTime = Date.now() - startTime;
      return {
        provider: this.providerName,
        status: 'healthy',
        configured: true,
        message: 'MyFatoorah API is reachable and responding',
        responseTime,
        timestamp,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error?.message || String(error);

      // If it's a 401/403, it means API is reachable but credentials are wrong
      if (error?.status === 401 || error?.status === 403) {
        return {
          provider: this.providerName,
          status: 'unhealthy',
          configured: true,
          message: 'MyFatoorah API is reachable but authentication failed',
          responseTime,
          error: errorMessage,
          timestamp,
        };
      }

      // If it's a 404 or "not found", it means API is reachable (this is expected)
      if (
        error?.status === 404 ||
        errorMessage.includes('not found') ||
        errorMessage.includes('No data match')
      ) {
        return {
          provider: this.providerName,
          status: 'healthy',
          configured: true,
          message: 'MyFatoorah API is reachable and responding',
          responseTime,
          timestamp,
        };
      }

      // Network error or other issues
      return {
        provider: this.providerName,
        status: 'unhealthy',
        configured: true,
        message: 'MyFatoorah API connection test failed',
        responseTime,
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * Cleanup resources on module destroy
   * This helps prevent memory leaks by closing HTTP connections
   */
  onModuleDestroy() {
    // Close HTTP agent connections to free memory
    if (this.http?.defaults?.httpAgent) {
      this.http.defaults.httpAgent.destroy();
    }
    if (this.http?.defaults?.httpsAgent) {
      this.http.defaults.httpsAgent.destroy();
    }
  }
}
