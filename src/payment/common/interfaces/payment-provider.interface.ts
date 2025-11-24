/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/**
 * Universal Payment Provider Interface
 *
 * This interface allows the system to support multiple payment gateways
 * (MyFatoorah, Stripe, PayMob, etc.) without code duplication.
 *
 * Any payment provider implementation must implement this interface
 * to be compatible with the payment system.
 *
 * This design follows the Strategy Pattern and allows easy addition
 * of new payment providers without modifying existing code.
 */
import { PaymentResult, PaymentPayload } from './payment-service.interface';

/**
 * Payment status result from provider
 */
export interface PaymentStatusResult {
  outcome: 'paid' | 'failed' | 'pending';
  transactionId: string; // Invoice ID, Payment Intent ID, etc.
  paymentId?: string; // Provider-specific payment ID
  amount?: number;
  currency?: string;
  raw?: any; // Raw response from provider
}

/**
 * Payment method information from provider
 */
export interface ProviderPaymentMethod {
  id: string | number; // Provider-specific payment method ID
  code: string; // Payment method code (e.g., 'KNET', 'card', 'wallet')
  nameEn: string; // English name
  nameAr?: string; // Arabic name (optional)
  isDirectPayment: boolean; // Whether it's a direct payment method (Apple Pay, Google Pay)
  serviceCharge?: number; // Service charge/fee
  totalAmount?: number; // Total amount including service charge
  currency?: string; // Currency code
  imageUrl?: string; // Payment method logo/image URL
  minLimit?: number; // Minimum payment amount
  maxLimit?: number; // Maximum payment amount
  note?: string; // Additional notes
}

/**
 * Available payment methods response
 */
export interface AvailablePaymentMethodsResponse {
  success: boolean;
  paymentMethods: ProviderPaymentMethod[];
  invoiceAmount?: number;
  currency?: string;
  timestamp?: string;
  fallback?: boolean; // Whether fallback methods were used
  message?: string; // Optional message
}

/**
 * Webhook event from payment provider
 */
export interface PaymentWebhookEvent {
  eventType: string | number; // Provider-specific event type
  transactionId: string; // Invoice ID, Payment Intent ID, etc.
  status: 'paid' | 'failed' | 'pending' | 'canceled';
  amount: number;
  currency: string;
  customerInfo?: {
    name?: string;
    email?: string;
    mobile?: string;
  };
  rawData: any; // Raw webhook data
  timestamp: string;
}

/**
 * Universal Payment Provider Interface
 *
 * All payment providers (MyFatoorah, Stripe, PayMob, etc.) must implement this interface
 * to ensure compatibility with the payment system.
 */
export interface IPaymentProvider {
  /**
   * Provider name (e.g., 'myfatoorah', 'stripe', 'paymob')
   */
  readonly providerName: string;

  /**
   * Provider version
   */
  readonly providerVersion?: string;

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean;

  /**
   * Create a payment/invoice
   * @param payload Payment payload with amount, currency, customer info, etc.
   * @param paymentMethodId Optional payment method ID (provider-specific)
   * @returns Payment result with transaction ID and payment URL
   */
  createPayment(
    payload: PaymentPayload & { paymentMethodId?: string | number },
  ): Promise<PaymentResult>;

  /**
   * Get payment status by transaction ID
   * @param transactionId Transaction/Invoice ID from provider
   * @returns Payment status result
   */
  getPaymentStatus(transactionId: string): Promise<PaymentStatusResult>;

  /**
   * Get available payment methods for a given amount and currency
   * @param invoiceAmount Invoice amount
   * @param currencyIso Currency ISO code (e.g., 'KWD', 'USD')
   * @returns Available payment methods with service charges
   */
  getAvailablePaymentMethods(
    invoiceAmount: number,
    currencyIso: string,
  ): Promise<AvailablePaymentMethodsResponse>;

  /**
   * Handle webhook event from provider
   * @param webhookData Raw webhook data from provider
   * @returns Normalized webhook event
   */
  handleWebhook(webhookData: any): Promise<PaymentWebhookEvent>;

  /**
   * Validate webhook signature/authenticity (optional)
   * @param webhookData Raw webhook data
   * @returns Whether webhook is valid
   */
  validateWebhook?(webhookData: any): Promise<boolean>;

  /**
   * Test connection to payment provider
   * Performs a lightweight API call to verify the provider is working
   * @returns Health check result with status and details
   */
  healthCheck?(): Promise<ProviderHealthCheckResult>;
}

/**
 * Provider health check result
 */
export interface ProviderHealthCheckResult {
  provider: string;
  status: 'healthy' | 'unhealthy' | 'not_configured';
  configured: boolean;
  message?: string;
  responseTime?: number; // in milliseconds
  error?: string;
  timestamp: string;
}

/**
 * Payment Provider Type
 * Used to identify which provider to use
 */
export type PaymentProviderType = 'myfatoorah' | 'stripe' | 'paymob' | string;

/**
 * Payment Provider Configuration
 */
export interface PaymentProviderConfig {
  provider: PaymentProviderType;
  enabled: boolean;
  priority?: number; // Lower number = higher priority
  config?: Record<string, any>; // Provider-specific configuration
}
