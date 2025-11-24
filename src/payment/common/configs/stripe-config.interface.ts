/**
 * Stripe Configuration Interface
 *
 * This interface allows StripeService to be configured flexibly
 * without depending on a specific config service implementation.
 *
 * You can implement this interface in your own config service,
 * or pass a simple object that matches this interface.
 *
 * Stripe API Documentation: https://stripe.com/docs/api
 */
export interface IStripeConfig {
  /**
   * Stripe Secret Key
   * Required for authentication
   * Get it from: https://dashboard.stripe.com/apikeys
   * Format: sk_test_... or sk_live_...
   */
  secretKey: string;

  /**
   * Stripe Publishable Key
   * Optional, used for client-side integration
   * Format: pk_test_... or pk_live_...
   */
  publishableKey?: string;

  /**
   * Stripe Webhook Secret
   * Required for webhook signature validation
   * Get it from: https://dashboard.stripe.com/webhooks
   */
  webhookSecret?: string;

  /**
   * Stripe API Version
   * Default: '2023-10-16'
   */
  apiVersion?: string;

  /**
   * Stripe API Base URL
   * Default: 'https://api.stripe.com/v1'
   */
  apiUrl?: string;

  /**
   * Success URL for redirect after payment
   * Optional, used for redirect-based flows
   */
  successUrl?: string;

  /**
   * Cancel URL for redirect after payment cancellation
   * Optional, used for redirect-based flows
   */
  cancelUrl?: string;
}

/**
 * Default Stripe configuration values
 */
export const DEFAULT_STRIPE_CONFIG: Partial<IStripeConfig> = {
  apiVersion: '2023-10-16',
  apiUrl: 'https://api.stripe.com/v1',
};

/**
 * Adapter for ConfigService to IStripeConfig
 * This allows backward compatibility with existing config services
 */
export interface IStripeConfigAdapter {
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  stripeApiVersion?: string;
  stripeApiUrl?: string;
  stripeSuccessUrl?: string;
  stripeCancelUrl?: string;
}

