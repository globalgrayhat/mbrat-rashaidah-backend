/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/**
 * Stripe Payment Provider Implementation
 *
 * This service is completely portable and can be used in any project.
 * It implements IPaymentProvider interface and can work with or without
 * a specific config service implementation.
 *
 * Features:
 * - Portable: No dependencies on project-specific logic
 * - Flexible: Can be configured via interface or direct values
 * - Supports Stripe payment methods (Card, Apple Pay, Google Pay, etc.)
 * - Implements IPaymentProvider for universal compatibility
 * - DRY: Follows the same pattern as other providers
 *
 * Stripe API Documentation: https://stripe.com/docs/api
 *
 * Usage:
 * ```typescript
 * // Option 1: With config service
 * const service = new StripeService(configService);
 *
 * // Option 2: With direct config
 * const service = new StripeService({
 *   secretKey: 'sk_test_...',
 *   webhookSecret: 'whsec_...',
 * });
 *
 * // Option 3: Environment variables (automatic)
 * const service = new StripeService(); // Reads from process.env
 * ```
 */
import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Optional,
  Logger,
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
} from '../common/interfaces/payment-service.interface';
import {
  IPaymentProvider,
  PaymentStatusResult,
  AvailablePaymentMethodsResponse,
  PaymentWebhookEvent,
  ProviderPaymentMethod,
  ProviderHealthCheckResult,
} from '../common/interfaces/payment-provider.interface';
import {
  IStripeConfig,
  DEFAULT_STRIPE_CONFIG,
  IStripeConfigAdapter,
} from '../common/configs/stripe-config.interface';

/**
 * Stripe Payment Intent Response
 */
interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
  metadata?: Record<string, string>;
  charges?: {
    data: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      [key: string]: any;
    }>;
  };
  [key: string]: any;
}

/**
 * Stripe Webhook Event Structure
 */
interface StripeWebhookEvent {
  id: string;
  object: 'event';
  type: string;
  data: {
    object: StripePaymentIntent | any;
  };
  created: number;
  [key: string]: any;
}

@Injectable()
export class StripeService implements IPaymentProvider, OnModuleDestroy {
  readonly providerName = 'stripe';
  readonly providerVersion = '1.0.0';
  private readonly logger = new Logger(StripeService.name);

  // Configuration
  private readonly secretKey: string;
  private readonly publishableKey?: string;
  private readonly webhookSecret?: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly successUrl?: string;
  private readonly cancelUrl?: string;

  // HTTP Client
  private readonly http: AxiosInstance;

  /**
   * Constructor accepts either:
   * 1. IStripeConfig object (portable)
   * 2. IStripeConfigAdapter (for ConfigService compatibility)
   * 3. undefined (reads from environment variables)
   */
  constructor(
    @Optional()
    config?: IStripeConfig | IStripeConfigAdapter,
  ) {
    // Normalize config to IStripeConfig format
    const normalizedConfig = this.normalizeConfig(config);

    // Validate required fields only if config is provided
    // If no config provided, service will be marked as not configured
    if (config && !normalizedConfig.secretKey) {
      throw new InternalServerErrorException(
        'Stripe Secret Key is required. Please provide secretKey in configuration or set STRIPE_SECRET_KEY environment variable.',
      );
    }

    // Set configuration (may be empty if not configured - service will be marked as not configured)
    this.secretKey = normalizedConfig.secretKey || '';
    this.publishableKey = normalizedConfig.publishableKey;
    this.webhookSecret = normalizedConfig.webhookSecret;
    this.apiVersion =
      normalizedConfig.apiVersion || DEFAULT_STRIPE_CONFIG.apiVersion || '';
    this.baseUrl =
      normalizedConfig.apiUrl || DEFAULT_STRIPE_CONFIG.apiUrl || '';
    this.successUrl = normalizedConfig.successUrl;
    this.cancelUrl = normalizedConfig.cancelUrl;

    // Initialize HTTP client with optimized configuration for memory management
    const http = require('http');
    const https = require('https');
    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.secretKey ? `Bearer ${this.secretKey}` : '',
        'Stripe-Version': this.apiVersion,
      },
      auth: {
        username: this.secretKey,
        password: '',
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

    if (this.isConfigured()) {
      this.logger.log('Stripe Service initialized');
    } else {
      this.logger.warn(
        'Stripe Service initialized but not configured. It will be skipped.',
      );
    }
  }

  /**
   * Normalize config from different sources to IStripeConfig
   */
  private normalizeConfig(
    config?: IStripeConfig | IStripeConfigAdapter,
  ): IStripeConfig {
    if (!config) {
      // Try to get from environment variables as fallback
      return {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        apiVersion: process.env.STRIPE_API_VERSION,
        apiUrl: process.env.STRIPE_API_URL,
        successUrl: process.env.STRIPE_SUCCESS_URL,
        cancelUrl: process.env.STRIPE_CANCEL_URL,
      };
    }

    // Check if it's an adapter (ConfigService style)
    if ('stripeSecretKey' in config) {
      const adapter = config;
      return {
        secretKey: adapter.stripeSecretKey || '',
        publishableKey: adapter.stripePublishableKey,
        webhookSecret: adapter.stripeWebhookSecret,
        apiVersion: adapter.stripeApiVersion,
        apiUrl: adapter.stripeApiUrl,
        successUrl: adapter.stripeSuccessUrl,
        cancelUrl: adapter.stripeCancelUrl,
      };
    }

    // Already in IStripeConfig format
    return config as IStripeConfig;
  }

  /**
   * Make HTTP request to Stripe API
   */
  private async request<T>(
    method: Method,
    url: string,
    data?: Record<string, any>,
    operationName = 'Stripe API call',
  ): Promise<T> {
    try {
      // Stripe API uses form-encoded data
      const formData = data
        ? new URLSearchParams(
            Object.entries(data).reduce(
              (acc, [key, value]) => {
                if (value !== undefined && value !== null) {
                  if (Array.isArray(value)) {
                    // Handle arrays (e.g., payment_method_types)
                    value.forEach((item, index) => {
                      acc[`${key}[${index}]`] = String(item);
                    });
                  } else if (typeof value === 'object') {
                    // Handle nested objects (e.g., metadata)
                    Object.entries(value).forEach(
                      ([nestedKey, nestedValue]) => {
                        acc[`${key}[${nestedKey}]`] = String(nestedValue);
                      },
                    );
                  } else {
                    acc[key] = String(value);
                  }
                }
                return acc;
              },
              {} as Record<string, string>,
            ),
          ).toString()
        : undefined;

      const config: AxiosRequestConfig = {
        method,
        url,
        ...(formData ? { data: formData } : {}),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${this.secretKey}`,
          'Stripe-Version': this.apiVersion,
        },
      };

      const response = await this.http.request<T>(config);

      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError;
      const statusCode = axiosError.response?.status;
      const errorData = axiosError.response?.data as {
        error?: { message?: string; type?: string };
      };
      const errorMessage = errorData?.error?.message || axiosError.message;

      this.logger.error(
        `${operationName} error:`,
        errorData || axiosError.message,
      );

      // Handle specific HTTP status codes
      if (statusCode === 401) {
        throw new UnauthorizedException(
          `Stripe authentication failed. Please check your secret key configuration. Original error: ${errorMessage}`,
        );
      }

      if (statusCode === 403) {
        throw new UnauthorizedException(
          `Stripe access forbidden. Please verify your API permissions. Original error: ${errorMessage}`,
        );
      }

      if (statusCode === 404) {
        throw new NotFoundException(
          `Stripe resource not found. Original error: ${errorMessage}`,
        );
      }

      throw new InternalServerErrorException(
        `Failed to ${operationName}: ${errorMessage}`,
      );
    }
  }

  // ==================== IPaymentProvider Implementation ====================

  /**
   * Check if Stripe provider is configured
   * Returns false if secret key is missing (service is optional)
   */
  isConfigured(): boolean {
    try {
      // Service is optional - return false if not configured
      if (!this.secretKey || !this.secretKey.trim()) {
        return false;
      }

      return !!(this.secretKey && this.baseUrl);
    } catch {
      return false;
    }
  }

  /**
   * Create a payment intent
   * @param payload Payment payload with amount, currency, customer info, etc.
   * @param paymentMethodId Optional payment method ID (Stripe payment method ID)
   * @returns Payment result with transaction ID and payment URL
   */
  async createPayment(
    payload: PaymentPayload & { paymentMethodId?: string | number },
  ): Promise<PaymentResult> {
    const {
      amount,
      currency,
      referenceId, // Generic reference ID (orderId, donationId, etc.)
      description,
      customerEmail,
      customerName,
      metadata,
      paymentMethodId,
    } = payload;

    // Validate service is configured
    if (!this.isConfigured()) {
      throw new InternalServerErrorException(
        'Stripe service is not configured. Please configure STRIPE_SECRET_KEY and other required settings.',
      );
    }

    // Convert amount to cents (Stripe uses smallest currency unit)
    const amountCents = this.convertToCents(amount, currency || 'usd');
    const currencyCode = (currency || 'usd').toLowerCase();

    // Build payment intent parameters
    const baseMetadata: Record<string, string> = {
      referenceId: String(referenceId),
      ...(metadata || {}),
    };

    if (customerName) {
      baseMetadata.customerName = customerName;
    }

    const paymentIntentParams: Record<string, any> = {
      amount: amountCents,
      currency: currencyCode,
      description: description || `Payment for ${referenceId}`,
      metadata: baseMetadata,
      ...(customerEmail && { receipt_email: customerEmail }),
    };

    // Add payment method if provided
    if (paymentMethodId) {
      paymentIntentParams.payment_method = String(paymentMethodId);
      paymentIntentParams.confirmation_method = 'manual';
      paymentIntentParams.confirm = true;
    }

    // Add payment method types
    paymentIntentParams.payment_method_types = ['card'];
    if (paymentMethodId === 'apple_pay' || paymentMethodId === 'google_pay') {
      paymentIntentParams.payment_method_types = [
        'card',
        'apple_pay',
        'google_pay',
      ];
    }

    // Create payment intent
    const paymentIntent = await this.request<StripePaymentIntent>(
      'post',
      '/payment_intents',
      paymentIntentParams,
      'Create Stripe payment intent',
    );

    if (!paymentIntent.id) {
      throw new InternalServerErrorException(
        'Stripe payment intent creation failed: Payment Intent ID not received',
      );
    }

    // Build payment URL
    // For Stripe, we can use Checkout Session or return client_secret for frontend
    let paymentUrl: string;
    if (this.successUrl && this.cancelUrl) {
      // Use Checkout Session for redirect-based flow
      const session = await this.request<any>(
        'post',
        '/checkout/sessions',
        {
          payment_intent: paymentIntent.id,
          success_url: this.successUrl.replace(
            '{referenceId}',
            String(referenceId),
          ),
          cancel_url: this.cancelUrl.replace(
            '{referenceId}',
            String(referenceId),
          ),
          mode: 'payment',
        },
        'Create Stripe checkout session',
      );
      paymentUrl = session.url || paymentIntent.client_secret;
    } else {
      // Return client_secret for frontend integration
      paymentUrl = paymentIntent.client_secret;
    }

    const mappedStatus = this.mapStripeStatus(paymentIntent.status);

    return {
      id: paymentIntent.id,
      url: paymentUrl,
      status: mappedStatus,
      rawResponse: paymentIntent,
    };
  }

  /**
   * Get payment status by transaction ID
   * @param transactionId Payment Intent ID from Stripe
   * @returns Payment status result
   */
  async getPaymentStatus(transactionId: string): Promise<PaymentStatusResult> {
    if (!transactionId) {
      throw new BadRequestException('Transaction ID is required');
    }

    // Validate service is configured
    if (!this.isConfigured()) {
      throw new InternalServerErrorException(
        'Stripe service is not configured. Please configure STRIPE_SECRET_KEY.',
      );
    }

    try {
      // Retrieve payment intent
      const paymentIntent = await this.request<StripePaymentIntent>(
        'get',
        `/payment_intents/${transactionId}`,
        undefined,
        'Get Stripe payment intent status',
      );

      // Map Stripe status to our standard status
      const outcome = this.mapStripeStatusToOutcome(paymentIntent.status);

      // Get charge ID if available
      const chargeId =
        paymentIntent.charges?.data?.[0]?.id ||
        (paymentIntent as any).latest_charge;

      return {
        outcome,
        transactionId: paymentIntent.id,
        paymentId: chargeId,
        amount: this.convertFromCents(
          paymentIntent.amount,
          paymentIntent.currency,
        ),
        currency: paymentIntent.currency.toUpperCase(),
        raw: paymentIntent,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          outcome: 'pending',
          transactionId,
          raw: { message: 'Payment intent not found, may still be processing' },
        };
      }
      throw error;
    }
  }

  /**
   * Get available payment methods for a given amount and currency
   * @param invoiceAmount Invoice amount
   * @param currencyIso Currency ISO code (e.g., 'USD', 'EUR')
   * @returns Available payment methods with service charges
   */
  async getAvailablePaymentMethods(
    invoiceAmount: number,
    currencyIso: string,
  ): Promise<AvailablePaymentMethodsResponse> {
    // Stripe supports various payment methods
    const paymentMethods: ProviderPaymentMethod[] = [
      {
        id: 'card',
        code: 'CARD',
        nameEn: 'Credit/Debit Card',
        nameAr: 'بطاقة ائتمان/خصم',
        isDirectPayment: false,
        serviceCharge: 0,
        totalAmount: invoiceAmount,
        currency: currencyIso,
        note: 'Visa, Mastercard, American Express, and other card networks',
      },
      {
        id: 'apple_pay',
        code: 'APPLE_PAY',
        nameEn: 'Apple Pay',
        nameAr: 'ابل باي',
        isDirectPayment: true,
        serviceCharge: 0,
        totalAmount: invoiceAmount,
        currency: currencyIso,
        note: 'Available on supported devices',
      },
      {
        id: 'google_pay',
        code: 'GOOGLE_PAY',
        nameEn: 'Google Pay',
        nameAr: 'جوجل باي',
        isDirectPayment: true,
        serviceCharge: 0,
        totalAmount: invoiceAmount,
        currency: currencyIso,
        note: 'Available on supported devices',
      },
    ];

    return {
      success: true,
      paymentMethods,
      invoiceAmount,
      currency: currencyIso,
      timestamp: new Date().toISOString(),
      message:
        'Payment methods retrieved. Actual availability depends on your Stripe account configuration and customer location.',
    };
  }

  /**
   * Handle webhook event from Stripe
   * @param webhookData Raw webhook data from Stripe
   * @returns Normalized webhook event
   */
  async handleWebhook(webhookData: any): Promise<PaymentWebhookEvent> {
    const event = webhookData as StripeWebhookEvent;
    const paymentIntent = event.data.object as StripePaymentIntent;

    // Map Stripe event type to our standard status
    const status = this.mapStripeEventTypeToStatus(event.type);

    return {
      eventType: event.type,
      transactionId: paymentIntent.id,
      status,
      amount: this.convertFromCents(
        paymentIntent.amount,
        paymentIntent.currency,
      ),
      currency: paymentIntent.currency.toUpperCase(),
      customerInfo: {
        email: (paymentIntent as any).receipt_email,
      },
      rawData: webhookData,
      timestamp: new Date(event.created * 1000).toISOString(),
    };
  }

  /**
   * Validate webhook signature/authenticity
   * Stripe uses HMAC SHA256 for webhook validation
   * @param webhookData Raw webhook data
   * @returns Whether webhook is valid
   */
  async validateWebhook(webhookData: any): Promise<boolean> {
    // Note: Full webhook signature validation requires the raw request body
    // and the Stripe-Signature header. This is a simplified check.
    // For production, implement full signature validation using crypto module.

    if (!this.webhookSecret) {
      this.logger.warn(
        'Stripe webhook secret not configured. Webhook validation skipped.',
      );
      return true; // Allow if no secret configured
    }

    // TODO: Implement full HMAC SHA256 validation
    // const crypto = require('crypto');
    // const signature = headers['stripe-signature'];
    // const expectedSignature = crypto
    //   .createHmac('sha256', this.webhookSecret)
    //   .update(rawBody)
    //   .digest('hex');
    // return signature === expectedSignature;

    // Basic validation: check if required fields exist
    return !!(
      webhookData &&
      webhookData.id &&
      webhookData.type &&
      webhookData.data
    );
  }

  // ==================== Helper Methods ====================

  /**
   * Convert amount to cents (Stripe uses smallest currency unit)
   */
  private convertToCents(amount: number, currency: string): number {
    // Most currencies use 2 decimal places, but some use 3 (like KWD)
    const decimalPlaces =
      currency === 'KWD' || currency === 'BHD' || currency === 'OMR' ? 3 : 2;
    return Math.round(amount * Math.pow(10, decimalPlaces));
  }

  /**
   * Convert cents to amount
   */
  private convertFromCents(cents: number, currency: string): number {
    const decimalPlaces =
      currency === 'kwd' || currency === 'bhd' || currency === 'omr' ? 3 : 2;
    return cents / Math.pow(10, decimalPlaces);
  }

  /**
   * Map Stripe payment intent status to our standard status
   */
  private mapStripeStatus(
    status: string,
  ): 'pending' | 'paid' | 'failed' | 'succeeded' | 'canceled' {
    const statusMap: Record<
      string,
      'pending' | 'paid' | 'failed' | 'succeeded' | 'canceled'
    > = {
      succeeded: 'paid',
      failed: 'failed',
      canceled: 'canceled',
      processing: 'pending',
      requires_payment_method: 'pending',
      requires_confirmation: 'pending',
      requires_action: 'pending',
    };
    return statusMap[status] || 'pending';
  }

  /**
   * Map Stripe payment intent status to outcome
   */
  private mapStripeStatusToOutcome(
    status: string,
  ): 'paid' | 'failed' | 'pending' {
    if (status === 'succeeded') {
      return 'paid';
    }
    if (status === 'failed' || status === 'canceled') {
      return 'failed';
    }
    return 'pending';
  }

  /**
   * Map Stripe event type to payment status
   */
  private mapStripeEventTypeToStatus(
    eventType: string,
  ): 'paid' | 'failed' | 'pending' | 'canceled' {
    if (eventType === 'payment_intent.succeeded') {
      return 'paid';
    }
    if (
      eventType === 'payment_intent.payment_failed' ||
      eventType === 'payment_intent.canceled'
    ) {
      return eventType === 'payment_intent.canceled' ? 'canceled' : 'failed';
    }
    return 'pending';
  }

  /**
   * Test connection to Stripe API
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
          'Stripe is not configured. Please set STRIPE_SECRET_KEY and other required environment variables.',
        timestamp,
      };
    }

    try {
      // Perform a lightweight API call to test connection
      // Using a simple balance or account endpoint
      await this.request<any>('get', '/balance', undefined, 'Health check');

      const responseTime = Date.now() - startTime;
      return {
        provider: this.providerName,
        status: 'healthy',
        configured: true,
        message: 'Stripe API is reachable and responding',
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
          message: 'Stripe API is reachable but authentication failed',
          responseTime,
          error: errorMessage,
          timestamp,
        };
      }

      // Network error or other issues
      return {
        provider: this.providerName,
        status: 'unhealthy',
        configured: true,
        message: 'Stripe API connection test failed',
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
