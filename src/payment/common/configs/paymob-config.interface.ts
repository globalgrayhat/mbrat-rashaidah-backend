/**
 * PayMob Supported Countries
 */
export type PayMobCountry =
  | 'EGYPT'
  | 'SAUDI_ARABIA'
  | 'UAE'
  | 'OMAN'
  | 'PAKISTAN';

/**
 * PayMob Country Configuration
 */
export interface PayMobCountryConfig {
  country: PayMobCountry;
  baseUrl: string;
  intentionApiUrl: string;
  defaultCurrency: string;
}

/**
 * PayMob country configurations
 * PayMob supports different countries with different API endpoints
 */
export const PAYMOB_COUNTRY_CONFIGS: Record<
  PayMobCountry,
  PayMobCountryConfig
> = {
  EGYPT: {
    country: 'EGYPT',
    baseUrl: 'https://accept.paymob.com/api',
    intentionApiUrl: 'https://accept.paymob.com/v1/intention',
    defaultCurrency: 'EGP',
  },
  SAUDI_ARABIA: {
    country: 'SAUDI_ARABIA',
    baseUrl: 'https://ksa.paymob.com/api',
    intentionApiUrl: 'https://ksa.paymob.com/v1/intention',
    defaultCurrency: 'SAR',
  },
  UAE: {
    country: 'UAE',
    baseUrl: 'https://uae.paymob.com/api',
    intentionApiUrl: 'https://uae.paymob.com/v1/intention',
    defaultCurrency: 'AED',
  },
  OMAN: {
    country: 'OMAN',
    baseUrl: 'https://oman.paymob.com/api',
    intentionApiUrl: 'https://oman.paymob.com/v1/intention',
    defaultCurrency: 'OMR',
  },
  PAKISTAN: {
    country: 'PAKISTAN',
    baseUrl: 'https://pakistan.paymob.com/api',
    intentionApiUrl: 'https://pakistan.paymob.com/v1/intention',
    defaultCurrency: 'PKR',
  },
};

/**
 * PayMob Configuration Interface
 *
 * This interface allows PayMobService to be configured flexibly
 * without depending on a specific config service implementation.
 *
 * You can implement this interface in your own config service,
 * or pass a simple object that matches this interface.
 *
 * PayMob API Documentation: https://docs.paymob.com/
 * PayMob supports: Egypt, Saudi Arabia, UAE, Oman, Pakistan
 */
export interface IPayMobConfig {
  /**
   * PayMob API Key (Legacy API Key for legacy flow)
   * Used for legacy authentication flow
   * Get it from: https://accept.paymob.com/portal/en/settings/company-settings
   * Format: Base64 encoded string
   * Environment variable: PAYMOB_API_KEY
   */
  apiKey?: string;

  /**
   * PayMob Secret Key (Token for Intention API - recommended)
   * Required for Intention API authentication
   * Get it from: https://accept.paymob.com/portal/en/settings/company-settings
   * Format: Token sk_test_... or sk_live_... or country-specific (egy_sk_test_...)
   * Environment variable: PAYMOB_SECRET_KEY
   */
  secretKey?: string;

  /**
   * PayMob Country
   * Determines the API base URL
   * Options: 'EGYPT', 'SAUDI_ARABIA', 'UAE', 'OMAN', 'PAKISTAN'
   * Default: 'EGYPT'
   */
  country?: PayMobCountry;

  /**
   * PayMob API Base URL (legacy API)
   * Auto-set based on country if not provided
   * Default: Based on country selection
   * Environment variable: PAYMOB_BASE_URL
   * Example: https://accept.paymob.com/
   */
  baseUrl?: string;

  /**
   * PayMob API Base URL (legacy API - alias for baseUrl)
   * Auto-set based on country if not provided
   * Default: Based on country selection
   */
  apiUrl?: string;

  /**
   * PayMob Intention API Base URL (new API - recommended)
   * Auto-set based on country if not provided
   * Default: Based on country selection
   * Environment variable: PAYMOB_INTENTION_BASE_URL
   * If not provided, will use baseUrl + 'v1/intention'
   */
  intentionApiUrl?: string;

  /**
   * Integration ID for card payments
   * Required for payment key generation
   * Get it from: https://accept.paymob.com/portal/en/integrations
   * Environment variable: PAYMOB_INTEGRATION_ID
   */
  integrationId?: number;

  /**
   * Iframe ID for payment iframe
   * Optional, used for iframe-based payments
   * Environment variable: PAYMOB_IFRAME_ID or PAYMOB_IFRAME_1_ID
   */
  iframeId?: number | string;

  /**
   * Callback URL for successful payments
   * Required for webhook handling
   */
  callbackUrl?: string;

  /**
   * Notification URL for payment status updates
   * Optional, used for webhook notifications
   */
  notificationUrl?: string;

  /**
   * Default currency code (ISO 4217)
   * Default: 'EGP'
   */
  defaultCurrency?: string;

  /**
   * Fallback phone number for billing data
   * Used when customer phone is not provided
   */
  fallbackPhone?: string;
}

/**
 * Default PayMob configuration values
 */
export const DEFAULT_PAYMOB_CONFIG: Partial<IPayMobConfig> = {
  country: 'EGYPT',
  defaultCurrency: 'EGP',
  fallbackPhone: '+201000000000',
};

/**
 * Adapter for ConfigService to IPayMobConfig
 * This allows backward compatibility with existing config services
 */
export interface IPayMobConfigAdapter {
  paymobApiKey?: string;
  paymobSecretKey?: string;
  paymobBaseUrl?: string;
  paymobCountry?: PayMobCountry;
  paymobApiUrl?: string;
  paymobIntentionApiUrl?: string;
  paymobIntegrationId?: number;
  paymobIframeId?: number | string;
  paymobCallbackUrl?: string;
  paymobNotificationUrl?: string;
  paymobDefaultCurrency?: string;
  paymobFallbackPhone?: string;
}
