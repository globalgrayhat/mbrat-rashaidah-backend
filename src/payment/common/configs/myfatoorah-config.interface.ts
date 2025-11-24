/**
 * MyFatoorah Configuration Interface
 *
 * This interface allows MyFatooraService to be configured flexibly
 * without depending on a specific config service implementation.
 *
 * You can implement this interface in your own config service,
 * or pass a simple object that matches this interface.
 */
export interface IMyFatoorahConfig {
  /**
   * MyFatoorah API Key
   * Required for authentication
   */
  apiKey: string;

  /**
   * MyFatoorah API URL
   * Default: 'https://apitest.myfatoorah.com/v2/'
   */
  apiUrl?: string;

  /**
   * Callback URL for successful payments
   * Required for payment creation
   */
  callbackUrl?: string;

  /**
   * Error URL for failed payments
   * Required for payment creation
   */
  errorUrl?: string;

  /**
   * Invoice TTL in minutes
   * Default: 60
   */
  invoiceTtlMinutes?: number;

  /**
   * Timezone for invoice expiry
   * Default: 'Asia/Kuwait'
   */
  timezone?: string;

  /**
   * TTL skew in seconds (buffer time)
   * Default: 30
   */
  ttlSkewSeconds?: number;
}

/**
 * Default MyFatoorah configuration values
 */
export const DEFAULT_MYFATOORAH_CONFIG: Partial<IMyFatoorahConfig> = {
  apiUrl: 'https://apitest.myfatoorah.com/v2/',
  invoiceTtlMinutes: 60,
  timezone: 'Asia/Kuwait',
  ttlSkewSeconds: 30,
};
