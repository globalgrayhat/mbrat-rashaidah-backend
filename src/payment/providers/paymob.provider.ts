/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/**
 * PayMob Payment Provider Implementation
 *
 * This service is completely portable and can be used in any project.
 * It implements IPaymentProvider interface and can work with or without
 * a specific config service implementation.
 *
 * Features:
 * - Portable: No dependencies on project-specific logic
 * - Flexible: Can be configured via interface or direct values
 * - Supports PayMob payment methods (Card, Wallet, etc.)
 * - Implements IPaymentProvider for universal compatibility
 * - DRY: Follows the same pattern as other providers
 *
 * PayMob API Documentation: https://docs.paymob.com/
 *
 * Usage:
 * ```typescript
 * // Option 1: With config service
 * const service = new PayMobService(configService);
 *
 * // Option 2: With direct config
 * const service = new PayMobService({
 *   apiKey: 'your-key',
 *   integrationId: 123456,
 *   callbackUrl: 'https://...',
 * });
 *
 * // Option 3: Environment variables (automatic)
 * const service = new PayMobService(); // Reads from process.env
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
  IPayMobConfig,
  DEFAULT_PAYMOB_CONFIG,
  IPayMobConfigAdapter,
  PayMobCountry,
  PAYMOB_COUNTRY_CONFIGS,
} from '../common/configs/paymob-config.interface';

/**
 * PayMob API Response Structure
 */
interface PayMobApiResponse<T = any> {
  id?: number;
  token?: string;
  order?: any;
  [key: string]: any;
}

/**
 * PayMob Authentication Response
 */
interface PayMobAuthResponse {
  token: string;
  profile: {
    id: number;
    username: string;
    email: string;
  };
}

/**
 * PayMob Payment Key Response
 */
interface PayMobPaymentKeyResponse {
  token: string;
}

/**
 * PayMob Transaction Response
 */
interface PayMobTransactionResponse {
  id: number;
  amount_cents: number;
  currency: string;
  success: boolean;
  pending: boolean;
  error_occured: boolean;
  has_parent_transaction: boolean;
  owner: number;
  data: {
    message?: string;
    [key: string]: any;
  };
  source_data: {
    type: string;
    pan?: string;
    sub_type?: string;
    [key: string]: any;
  };
  created_at: string;
  [key: string]: any;
}

/**
 * PayMob Webhook Event Structure
 */
interface PayMobWebhookData {
  obj: {
    id: number;
    amount_cents: number;
    currency: string;
    success: boolean;
    pending: boolean;
    error_occured: boolean;
    order: {
      id: number;
      amount_cents: number;
      currency: string;
      merchant_order_id: string;
      [key: string]: any;
    };
    created_at: string;
    [key: string]: any;
  };
  type: string;
  hmac?: string;
}

@Injectable()
export class PayMobService implements IPaymentProvider, OnModuleDestroy {
  readonly providerName = 'paymob';
  readonly providerVersion = '1.0.0';
  private readonly logger = new Logger(PayMobService.name);

  // Configuration
  private readonly apiKey: string; // Legacy API key (for legacy flow)
  private readonly secretKey: string; // Secret key (for Intention API - recommended)
  private readonly baseUrl: string; // Legacy API base URL
  private readonly intentionBaseUrl: string; // Intention API base URL
  private readonly integrationId?: number;
  private readonly iframeId?: number | string;
  private readonly callbackUrl?: string;
  private readonly notificationUrl?: string;
  private readonly defaultCurrency: string;
  private readonly fallbackPhone: string;
  private readonly country: PayMobCountry;

  // HTTP Client
  private readonly http: AxiosInstance;

  // Authentication token (cached)
  private authToken: string | null = null;
  private authTokenExpiry: Date | null = null;

  /**
   * Constructor accepts either:
   * 1. IPayMobConfig object (portable)
   * 2. IPayMobConfigAdapter (for ConfigService compatibility)
   * 3. undefined (reads from environment variables)
   */
  constructor(
    @Optional()
    config?: IPayMobConfig | IPayMobConfigAdapter,
  ) {
    // Normalize config to IPayMobConfig format
    const normalizedConfig = this.normalizeConfig(config);

    // Validate required fields only if config is provided
    // If no config provided, service will be marked as not configured
    // We need either apiKey (legacy) or secretKey (Intention API)
    if (config && !normalizedConfig.apiKey && !normalizedConfig.secretKey) {
      throw new InternalServerErrorException(
        'PayMob API Key or Secret Key is required. Please provide apiKey/secretKey in configuration or set PAYMOB_API_KEY/PAYMOB_SECRET_KEY environment variable.',
      );
    }

    // Set API keys (may be empty if not configured - service will be marked as not configured)
    this.apiKey = normalizedConfig.apiKey || '';
    this.secretKey = normalizedConfig.secretKey || '';

    // Set base URLs
    // Support both baseUrl and apiUrl (baseUrl takes precedence)
    const rawBaseUrl = normalizedConfig.baseUrl || normalizedConfig.apiUrl;
    this.baseUrl = this.normalizeBaseUrl(rawBaseUrl);

    // Set intention base URL
    // If not provided, derive from baseUrl or use country config
    if (normalizedConfig.intentionApiUrl) {
      this.intentionBaseUrl = this.normalizeBaseUrl(
        normalizedConfig.intentionApiUrl,
      );
    } else if (this.baseUrl) {
      // Derive from baseUrl: https://accept.paymob.com/ -> https://accept.paymob.com/v1/intention
      this.intentionBaseUrl = this.baseUrl.replace(/\/$/, '') + '/v1/intention';
    } else {
      // Use country config
      const countryConfig =
        PAYMOB_COUNTRY_CONFIGS[normalizedConfig.country || 'EGYPT'];
      this.intentionBaseUrl = this.normalizeBaseUrl(
        countryConfig.intentionApiUrl,
      );
    }

    this.integrationId = normalizedConfig.integrationId;
    // Support both number and string for iframeId
    const iframeIdValue = normalizedConfig.iframeId;
    this.iframeId =
      typeof iframeIdValue === 'string'
        ? Number(iframeIdValue) || iframeIdValue
        : iframeIdValue;
    this.callbackUrl = normalizedConfig.callbackUrl;
    this.notificationUrl = normalizedConfig.notificationUrl;
    this.defaultCurrency =
      normalizedConfig.defaultCurrency ??
      DEFAULT_PAYMOB_CONFIG.defaultCurrency ??
      'EGP';
    this.fallbackPhone =
      normalizedConfig.fallbackPhone ??
      DEFAULT_PAYMOB_CONFIG.fallbackPhone ??
      '+201000000000';
    this.country = normalizedConfig.country || 'EGYPT';

    // Initialize HTTP client with dynamic base URL
    // Base URL will be determined per request (Intention API vs Legacy API)
    this.http = axios.create({
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (this.isConfigured()) {
      this.logger.log(
        `PayMob Service initialized for country: ${this.country}`,
      );
    } else {
      this.logger.warn(
        'PayMob Service initialized but not configured. It will be skipped.',
      );
    }
  }

  /**
   * Normalize config from different sources to IPayMobConfig
   */
  private normalizeConfig(
    config?: IPayMobConfig | IPayMobConfigAdapter,
  ): IPayMobConfig {
    if (!config) {
      // Try to get from environment variables as fallback
      // Support both PAYMOB_BASE_URL and PAYMOB_API_URL
      const baseUrl =
        process.env.PAYMOB_BASE_URL || process.env.PAYMOB_API_URL || '';
      const intentionBaseUrl = process.env.PAYMOB_INTENTION_BASE_URL || '';

      return {
        apiKey: process.env.PAYMOB_API_KEY || '',
        secretKey: process.env.PAYMOB_SECRET_KEY || '',
        baseUrl: baseUrl || undefined,
        apiUrl: baseUrl || undefined, // Alias for backward compatibility
        intentionApiUrl: intentionBaseUrl || undefined,
        integrationId: process.env.PAYMOB_INTEGRATION_ID
          ? Number(process.env.PAYMOB_INTEGRATION_ID)
          : undefined,
        iframeId:
          process.env.PAYMOB_IFRAME_ID ||
          process.env.PAYMOB_IFRAME_1_ID ||
          undefined,
        callbackUrl: process.env.PAYMOB_CALLBACK_URL,
        notificationUrl: process.env.PAYMOB_NOTIFICATION_URL,
        defaultCurrency: process.env.PAYMOB_DEFAULT_CURRENCY,
        fallbackPhone: process.env.PAYMOB_FALLBACK_PHONE,
      };
    }

    // Check if it's an adapter (ConfigService style)
    if ('paymobApiKey' in config) {
      const adapter = config;
      const country = (adapter.paymobCountry as PayMobCountry) || 'EGYPT';
      const countryConfig =
        PAYMOB_COUNTRY_CONFIGS[country] || PAYMOB_COUNTRY_CONFIGS.EGYPT;

      return {
        apiKey: adapter.paymobApiKey || '',
        secretKey: adapter.paymobSecretKey || '',
        country: country,
        baseUrl:
          adapter.paymobBaseUrl ||
          adapter.paymobApiUrl ||
          countryConfig.baseUrl,
        apiUrl:
          adapter.paymobBaseUrl ||
          adapter.paymobApiUrl ||
          countryConfig.baseUrl, // Alias
        intentionApiUrl:
          adapter.paymobIntentionApiUrl || countryConfig.intentionApiUrl,
        integrationId: adapter.paymobIntegrationId,
        iframeId: adapter.paymobIframeId,
        callbackUrl: adapter.paymobCallbackUrl,
        notificationUrl: adapter.paymobNotificationUrl,
        defaultCurrency:
          adapter.paymobDefaultCurrency || countryConfig.defaultCurrency,
        fallbackPhone: adapter.paymobFallbackPhone,
      };
    }

    // Already in IPayMobConfig format
    const directConfig = config as IPayMobConfig;
    if (!directConfig.country) {
      // Set default country if not provided
      directConfig.country = 'EGYPT';
    }
    const countryConfig =
      PAYMOB_COUNTRY_CONFIGS[directConfig.country] ||
      PAYMOB_COUNTRY_CONFIGS.EGYPT;

    return {
      ...directConfig,
      baseUrl:
        directConfig.baseUrl || directConfig.apiUrl || countryConfig.baseUrl,
      apiUrl:
        directConfig.baseUrl || directConfig.apiUrl || countryConfig.baseUrl, // Alias
      intentionApiUrl:
        directConfig.intentionApiUrl || countryConfig.intentionApiUrl,
      defaultCurrency:
        directConfig.defaultCurrency || countryConfig.defaultCurrency,
    };
  }

  /**
   * Normalize base URL (ensure it ends with /)
   */
  private normalizeBaseUrl(url?: string): string {
    if (!url) return '';
    return url.endsWith('/') ? url : `${url}/`;
  }

  /**
   * Make HTTP request to PayMob API
   * Uses Intention API base URL for new API endpoints
   */
  private async request<T>(
    method: Method,
    url: string,
    data?: unknown,
    operationName = 'PayMob API call',
    useIntentionApi = false, // Use Intention API base URL
  ): Promise<T> {
    try {
      // Determine base URL
      const baseUrl = useIntentionApi ? this.intentionBaseUrl : this.baseUrl;

      // If URL is already absolute, use it as is
      const fullUrl = url.startsWith('http')
        ? url
        : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;

      const config: AxiosRequestConfig = {
        method,
        url: fullUrl,
        ...(data !== undefined ? { data } : {}),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // Add Authorization header for Intention API (use secretKey directly)
          // For legacy API, we use authToken from authenticate()
          ...(useIntentionApi && this.secretKey
            ? { Authorization: `Token ${this.secretKey}` }
            : this.authToken && !useIntentionApi
              ? { Authorization: `Token ${this.authToken}` }
              : {}),
        },
      };

      const response = await this.http.request<T>(config);

      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError;
      const statusCode = axiosError.response?.status;
      const errorMessage =
        (axiosError.response?.data as { message?: string })?.message ||
        axiosError.message;

      this.logger.error(
        `${operationName} error:`,
        axiosError.response?.data || axiosError.message,
      );

      // Handle specific HTTP status codes
      if (statusCode === 401) {
        throw new UnauthorizedException(
          `PayMob authentication failed. Please check your API key configuration. Original error: ${errorMessage}`,
        );
      }

      if (statusCode === 403) {
        throw new UnauthorizedException(
          `PayMob access forbidden. Please verify your API permissions. Original error: ${errorMessage}`,
        );
      }

      if (statusCode === 404) {
        throw new NotFoundException(
          `PayMob resource not found. Original error: ${errorMessage}`,
        );
      }

      throw new InternalServerErrorException(
        `Failed to ${operationName}: ${errorMessage}`,
      );
    }
  }

  /**
   * Authenticate with PayMob API and get auth token
   * Token is cached to avoid unnecessary API calls
   */
  async authenticate(): Promise<void> {
    // Check if we have a valid cached token
    if (
      this.authToken &&
      this.authTokenExpiry &&
      this.authTokenExpiry > new Date()
    ) {
      return;
    }

    try {
      const response = await this.request<PayMobAuthResponse>(
        'post',
        '/auth/tokens',
        {
          api_key: this.apiKey,
        },
        'PayMob authentication',
      );

      if (!response.token) {
        throw new InternalServerErrorException(
          'PayMob authentication failed: Token not received',
        );
      }

      // Cache token for 23 hours (PayMob tokens typically expire in 24 hours)
      this.authToken = response.token;
      this.authTokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);

      this.logger.debug('PayMob authentication successful');
    } catch (error) {
      this.authToken = null;
      this.authTokenExpiry = null;
      throw error;
    }
  }

  /**
   * Ensure we have a valid auth token
   */
  private async ensureAuthToken(): Promise<string> {
    await this.authenticate();
    if (!this.authToken) {
      throw new UnauthorizedException(
        'PayMob authentication token not available',
      );
    }
    return this.authToken;
  }

  /**
   * Convert amount to cents (PayMob uses cents)
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
      currency === 'KWD' || currency === 'BHD' || currency === 'OMR' ? 3 : 2;
    return cents / Math.pow(10, decimalPlaces);
  }

  /**
   * Resolve payment methods array for Intention API
   * Supports:
   * - Integration IDs (numbers): [12, 13]
   * - Method names (strings): ["card"]
   * - Mixed: [12, "card"]
   * - paymentMethodId from payload can be:
   *   - number: Integration ID
   *   - string: Method name ("card") or Integration ID as string
   *   - undefined: Use default integrationId or fallback to "card"
   */
  private resolvePaymentMethods(
    paymentMethodId?: string | number,
  ): (number | string)[] {
    // If paymentMethodId is provided, use it
    if (paymentMethodId !== undefined && paymentMethodId !== null) {
      // If it's a string that looks like a number, convert it
      if (typeof paymentMethodId === 'string') {
        const numId = Number(paymentMethodId);
        if (!Number.isNaN(numId)) {
          // It's a numeric string (Integration ID)
          return [numId];
        }
        // It's a method name (e.g., "card")
        return [paymentMethodId];
      }
      // It's a number (Integration ID)
      return [paymentMethodId];
    }

    // No paymentMethodId provided, use default integrationId or "card"
    if (this.integrationId) {
      return [this.integrationId];
    }

    // Last resort: use "card" as default
    return ['card'];
  }

  /**
   * Build billing data from payment payload
   */
  private buildBillingData(payload: PaymentPayload): any {
    // Split customer name into first and last name
    const nameParts = (payload.customerName || 'Customer').split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'Customer';

    return {
      apartment: 'NA',
      email: payload.customerEmail || '',
      floor: 'NA',
      first_name: firstName,
      street: 'NA',
      building: 'NA',
      phone_number: payload.customerMobile || this.fallbackPhone,
      shipping_method: 'UNK',
      postal_code: 'NA',
      city: 'NA',
      country: 'NA',
      last_name: lastName,
      state: 'NA',
    };
  }

  // ==================== IPaymentProvider Implementation ====================

  /**
   * Check if PayMob provider is configured
   * Returns false if API key is missing (service is optional)
   */
  isConfigured(): boolean {
    try {
      // Service is configured if:
      // 1. Has secretKey (for Intention API) OR apiKey (for legacy flow)
      // 2. Has baseUrl (for legacy) OR intentionBaseUrl (for Intention API)
      // 3. Has integrationId OR callbackUrl (for webhook-based flows)
      const hasAuth = !!(this.secretKey || this.apiKey);
      const hasBaseUrl = !!(this.baseUrl || this.intentionBaseUrl);
      const hasConfig = !!(this.integrationId || this.callbackUrl);

      return hasAuth && hasBaseUrl && hasConfig;
    } catch {
      return false;
    }
  }

  /**
   * Create a payment/invoice
   * @param payload Payment payload with amount, currency, customer info, etc.
   * @param paymentMethodId Optional payment method ID (not used for PayMob, but kept for interface compatibility)
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
      customerName,
      customerEmail,
      customerMobile,
    } = payload;

    // Use Intention API if secretKey is available (recommended)
    // Otherwise, fallback to legacy flow with apiKey
    if (this.secretKey && this.intentionBaseUrl) {
      return this.createPaymentWithIntentionAPI(payload);
    }

    // Legacy flow (requires apiKey, integrationId, and callbackUrl)
    if (!this.apiKey) {
      throw new BadRequestException(
        'PayMob API Key is required for legacy flow. Please configure PAYMOB_API_KEY or use PAYMOB_SECRET_KEY for Intention API.',
      );
    }

    if (!this.callbackUrl) {
      throw new BadRequestException(
        'Callback URL is required. Please configure paymobCallbackUrl.',
      );
    }

    if (!this.integrationId) {
      throw new BadRequestException(
        'Integration ID is required. Please configure paymobIntegrationId.',
      );
    }

    // Ensure authentication for legacy flow
    const token = await this.ensureAuthToken();

    // Convert amount to cents
    const amountCents = this.convertToCents(
      amount,
      currency || this.defaultCurrency,
    );
    const currencyCode = currency || this.defaultCurrency;

    // Step 1: Create order
    const orderResponse = await this.request<PayMobApiResponse>(
      'post',
      '/ecommerce/orders',
      {
        auth_token: token,
        delivery_needed: 'false',
        amount_cents: amountCents,
        currency: currencyCode,
        merchant_order_id: referenceId, // Use generic referenceId
        items: [
          {
            name: description || 'Payment',
            amount_cents: amountCents,
            description: description || 'Payment',
            quantity: 1,
          },
        ],
      },
      'Create PayMob order',
    );

    if (!orderResponse.id) {
      throw new InternalServerErrorException(
        'PayMob order creation failed: Order ID not received',
      );
    }

    // Step 2: Generate payment key
    const billingData = this.buildBillingData(payload);

    const paymentKeyResponse = await this.request<PayMobPaymentKeyResponse>(
      'post',
      '/acceptance/payment_keys',
      {
        auth_token: token,
        amount_cents: amountCents,
        expiration: 3600, // 1 hour
        order_id: orderResponse.id,
        billing_data: billingData,
        currency: currencyCode,
        integration_id: this.integrationId,
        lock_order_when_paid: 'false',
      },
      'Generate PayMob payment key',
    );

    if (!paymentKeyResponse.token) {
      throw new InternalServerErrorException(
        'PayMob payment key generation failed: Token not received',
      );
    }

    // Step 3: Build payment URL
    // Use baseUrl if available, otherwise fallback to default
    const baseUrlForIframe = this.baseUrl || 'https://accept.paymob.com/';
    const cleanBaseUrl = baseUrlForIframe.replace(/\/$/, '');
    const paymentUrl = this.iframeId
      ? `${cleanBaseUrl}/api/acceptance/iframes/${this.iframeId}?payment_token=${paymentKeyResponse.token}`
      : `${cleanBaseUrl}/api/acceptance/payment_keys/${paymentKeyResponse.token}`;

    return {
      id: String(orderResponse.id), // Use order ID as transaction ID
      url: paymentUrl,
      status: 'pending',
      rawResponse: {
        orderId: orderResponse.id,
        paymentToken: paymentKeyResponse.token,
        amountCents,
        currency: currencyCode,
      },
    };
  }

  /**
   * Create payment using PayMob Intention API (recommended)
   * This is the modern PayMob API that uses secretKey directly
   */
  private async createPaymentWithIntentionAPI(
    payload: PaymentPayload & { paymentMethodId?: string | number },
  ): Promise<PaymentResult> {
    const {
      amount,
      currency,
      referenceId,
      description,
      customerName,
      customerEmail,
      customerMobile,
      metadata,
    } = payload;

    // Convert amount to cents
    const amountCents = this.convertToCents(
      amount,
      currency || this.defaultCurrency,
    );
    const currencyCode = currency || this.defaultCurrency;

    // Build billing data
    const billingData = this.buildBillingData(payload);

    // Split customer name
    const nameParts = (customerName || 'Customer').split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'Customer';

    // Determine payment methods based on paymentMethodId from payload
    // PayMob supports: Integration IDs (numbers), method names (strings), or both
    // Examples: [12, "card"] or [12] or ["card"]
    const paymentMethods = this.resolvePaymentMethods(payload.paymentMethodId);

    // Build Intention API payload
    const intentionPayload: any = {
      amount: amountCents,
      currency: currencyCode,
      payment_methods: paymentMethods,
      items: [
        {
          name: description || 'Payment',
          amount: amountCents,
          description: description || 'Payment',
          quantity: 1,
        },
      ],
      billing_data: billingData,
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: customerEmail || '',
        ...(customerMobile && { phone_number: customerMobile }),
      },
      extras: {
        referenceId: referenceId,
        ...(metadata || {}),
      },
      special_reference: String(referenceId),
    };

    // Add callback URLs if configured
    if (this.callbackUrl) {
      intentionPayload.redirection_url = this.callbackUrl;
    }
    if (this.notificationUrl) {
      intentionPayload.notification_url = this.notificationUrl;
    }

    try {
      // Call Intention API
      const response = await this.request<any>(
        'post',
        '/', // Intention API endpoint: /v1/intention/
        intentionPayload,
        'Create PayMob intention',
        true, // Use Intention API
      );

      // Extract payment key or URL from response
      const paymentKey =
        response.payment_keys?.[0]?.key ||
        response.client_secret ||
        response.id;

      if (!paymentKey) {
        throw new InternalServerErrorException(
          'PayMob intention creation failed: Payment key not received',
        );
      }

      // Build payment URL
      let paymentUrl: string | undefined;
      if (this.iframeId) {
        const cleanBaseUrl = (
          this.baseUrl || 'https://accept.paymob.com/'
        ).replace(/\/$/, '');
        paymentUrl = `${cleanBaseUrl}/api/acceptance/iframes/${this.iframeId}?payment_token=${paymentKey}`;
      } else if (response.payment_keys?.[0]?.redirection_url) {
        paymentUrl = response.payment_keys[0].redirection_url;
      } else if (response.redirection_url) {
        paymentUrl = response.redirection_url;
      }

      return {
        id: String(response.id || paymentKey),
        url: paymentUrl,
        status: 'pending',
        rawResponse: {
          intentionId: response.id,
          paymentKey,
          amountCents,
          currency: currencyCode,
          response,
        },
      };
    } catch (error) {
      this.logger.error('PayMob Intention API error:', error);
      throw error;
    }
  }

  /**
   * Get payment status by transaction ID
   * @param transactionId Transaction/Order ID from PayMob
   * @returns Payment status result
   */
  async getPaymentStatus(transactionId: string): Promise<PaymentStatusResult> {
    if (!transactionId) {
      throw new BadRequestException('Transaction ID is required');
    }

    // Get transaction details
    // Try Intention API first if secretKey is available, otherwise use legacy API
    try {
      let transactionResponse: PayMobTransactionResponse;

      if (this.secretKey && this.intentionBaseUrl) {
        // Use Intention API
        transactionResponse = await this.request<PayMobTransactionResponse>(
          'get',
          `/${transactionId}`, // Intention API endpoint: /v1/intention/{id}
          undefined,
          'Get PayMob intention status',
          true, // Use Intention API
        );
      } else {
        // Use legacy API
        const token = await this.ensureAuthToken();
        transactionResponse = await this.request<PayMobTransactionResponse>(
          'get',
          `/acceptance/transactions/${transactionId}`, // Legacy API endpoint
          undefined,
          'Get PayMob transaction status',
          false, // Use legacy API
        );
      }

      // Map PayMob status to our standard status
      let outcome: 'paid' | 'failed' | 'pending' = 'pending';
      if (transactionResponse.success && !transactionResponse.pending) {
        outcome = 'paid';
      } else if (
        transactionResponse.error_occured ||
        (!transactionResponse.success && !transactionResponse.pending)
      ) {
        outcome = 'failed';
      }

      return {
        outcome,
        transactionId: String(transactionResponse.id),
        paymentId: String(transactionResponse.id),
        amount: this.convertFromCents(
          transactionResponse.amount_cents,
          transactionResponse.currency,
        ),
        currency: transactionResponse.currency,
        raw: transactionResponse,
      };
    } catch (error) {
      // If transaction not found, try to get from order
      if (error instanceof NotFoundException) {
        // Try alternative endpoint or return pending status
        return {
          outcome: 'pending',
          transactionId,
          raw: { message: 'Transaction not found, may still be processing' },
        };
      }
      throw error;
    }
  }

  /**
   * Get available payment methods for a given amount and currency
   * @param invoiceAmount Invoice amount
   * @param currencyIso Currency ISO code (e.g., 'EGP', 'USD')
   * @returns Available payment methods with service charges
   */
  async getAvailablePaymentMethods(
    invoiceAmount: number,
    currencyIso: string,
  ): Promise<AvailablePaymentMethodsResponse> {
    // PayMob typically supports these payment methods
    // Note: Actual available methods depend on your PayMob account configuration
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
        note: 'Visa, Mastercard, and other card networks',
      },
      {
        id: 'wallet',
        code: 'WALLET',
        nameEn: 'Mobile Wallet',
        nameAr: 'محفظة إلكترونية',
        isDirectPayment: false,
        serviceCharge: 0,
        totalAmount: invoiceAmount,
        currency: currencyIso,
        note: 'Vodafone Cash, Etisalat Cash, etc.',
      },
    ];

    return {
      success: true,
      paymentMethods,
      invoiceAmount,
      currency: currencyIso,
      timestamp: new Date().toISOString(),
      message:
        'Payment methods retrieved. Actual availability depends on your PayMob account configuration.',
    };
  }

  /**
   * Handle webhook event from PayMob
   * @param webhookData Raw webhook data from PayMob
   * @returns Normalized webhook event
   */
  async handleWebhook(webhookData: any): Promise<PaymentWebhookEvent> {
    const event = webhookData as PayMobWebhookData;

    // Extract transaction data
    // PayMob webhook structure may vary between Intention API and Legacy API
    const transaction = event.obj || event;
    const order = transaction.order || {};

    // Map PayMob status to our standard status
    // Intention API may use different status fields
    let status: 'paid' | 'failed' | 'pending' | 'canceled' = 'pending';

    // Check for Intention API status format
    if (transaction.status === 'paid' || transaction.status === 'success') {
      status = 'paid';
    } else if (
      transaction.status === 'failed' ||
      transaction.status === 'error'
    ) {
      status = 'failed';
    } else if (
      transaction.status === 'canceled' ||
      transaction.status === 'cancelled'
    ) {
      status = 'canceled';
    } else if (transaction.success && !transaction.pending) {
      // Legacy API format
      status = 'paid';
    } else if (transaction.error_occured) {
      status = 'failed';
    } else if (transaction.pending) {
      status = 'pending';
    }

    return {
      eventType: event.type || 'transaction',
      transactionId: String(transaction.id || order.id || ''),
      status,
      amount: this.convertFromCents(
        transaction.amount_cents || order.amount_cents || 0,
        transaction.currency || 'EGP',
      ),
      currency: transaction.currency || order.currency || 'EGP',
      customerInfo: {
        // PayMob webhook may include customer info in transaction data
        email: (transaction as any).customer?.email,
        mobile: (transaction as any).customer?.phone,
      },
      rawData: webhookData,
      timestamp: transaction.created_at || new Date().toISOString(),
    };
  }

  /**
   * Validate webhook signature/authenticity
   * PayMob uses HMAC for webhook validation
   * @param webhookData Raw webhook data
   * @returns Whether webhook is valid
   */
  async validateWebhook(webhookData: any): Promise<boolean> {
    const event = webhookData as PayMobWebhookData;

    // If HMAC is provided, validate it
    if (event.hmac) {
      // TODO: Implement HMAC validation
      // const calculatedHmac = crypto
      //   .createHmac('sha512', this.apiKey)
      //   .update(JSON.stringify(event.obj))
      //   .digest('hex');
      // return calculatedHmac === event.hmac;
      this.logger.warn(
        'HMAC validation not implemented. Please implement for production use.',
      );
    }

    // Basic validation: check if required fields exist
    return !!(event.obj && (event.obj.id || event.obj.order?.id) && event.type);
  }

  /**
   * Test connection to PayMob API
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
          'PayMob is not configured. Please set PAYMOB_SECRET_KEY or PAYMOB_API_KEY and other required environment variables.',
        timestamp,
      };
    }

    try {
      // For Intention API, try to authenticate or make a lightweight call
      if (this.secretKey && this.intentionBaseUrl) {
        // Try to make a lightweight request to test connection
        // We'll use a simple request that should fail gracefully if API is unreachable
        await this.request(
          'get',
          '/test', // This endpoint likely doesn't exist, but will test connectivity
          undefined,
          'Health check',
          true, // Use Intention API
        );
      } else if (this.apiKey && this.baseUrl) {
        // For legacy API, try authentication
        await this.authenticate();
      }

      const responseTime = Date.now() - startTime;
      return {
        provider: this.providerName,
        status: 'healthy',
        configured: true,
        message: 'PayMob API is reachable and responding',
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
          message: 'PayMob API is reachable but authentication failed',
          responseTime,
          error: errorMessage,
          timestamp,
        };
      }

      // If it's a 404, it means API is reachable (this is expected for test endpoint)
      if (error?.status === 404) {
        return {
          provider: this.providerName,
          status: 'healthy',
          configured: true,
          message: 'PayMob API is reachable and responding',
          responseTime,
          timestamp,
        };
      }

      // Network error or other issues
      return {
        provider: this.providerName,
        status: 'unhealthy',
        configured: true,
        message: 'PayMob API connection test failed',
        responseTime,
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * Cleanup resources on module destroy
   * This helps prevent memory leaks by closing HTTP connections and clearing cache
   */
  onModuleDestroy() {
    // Clear authentication token cache to free memory
    this.authToken = null;
    this.authTokenExpiry = null;

    // Close HTTP agent connections to free memory
    if (this.http?.defaults?.httpAgent) {
      this.http.defaults.httpAgent.destroy();
    }
    if (this.http?.defaults?.httpsAgent) {
      this.http.defaults.httpsAgent.destroy();
    }
  }
}
