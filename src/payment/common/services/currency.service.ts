import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * Supported currency codes (ISO 4217)
 */
export const SUPPORTED_CURRENCIES = [
  'KWD', // Kuwaiti Dinar
  'USD', // US Dollar
  'EUR', // Euro
  'GBP', // British Pound
  'SAR', // Saudi Riyal
  'AED', // UAE Dirham
  'BHD', // Bahraini Dinar
  'OMR', // Omani Rial
  'QAR', // Qatari Riyal
  'EGP', // Egyptian Pound
  'JOD', // Jordanian Dinar
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Currency metadata
 */
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

/**
 * Currency metadata mapping
 */
const CURRENCY_INFO: Record<SupportedCurrency, CurrencyInfo> = {
  KWD: { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', decimalPlaces: 3 },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2 },
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', decimalPlaces: 2 },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimalPlaces: 2 },
  BHD: {
    code: 'BHD',
    name: 'Bahraini Dinar',
    symbol: '.د.ب',
    decimalPlaces: 3,
  },
  OMR: { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', decimalPlaces: 3 },
  QAR: { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', decimalPlaces: 2 },
  EGP: { code: 'EGP', name: 'Egyptian Pound', symbol: 'ج.م', decimalPlaces: 2 },
  JOD: {
    code: 'JOD',
    name: 'Jordanian Dinar',
    symbol: 'د.ا',
    decimalPlaces: 3,
  },
};

/**
 * Centralized currency handling service
 * Provides currency validation, formatting, and conversion utilities
 */
@Injectable()
export class CurrencyService {
  /**
   * Validate if a currency code is supported
   */
  isValidCurrency(currency: string): currency is SupportedCurrency {
    return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency);
  }

  /**
   * Get currency information
   */
  getCurrencyInfo(currency: string): CurrencyInfo {
    if (!this.isValidCurrency(currency)) {
      throw new BadRequestException(
        `Unsupported currency: ${currency}. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`,
      );
    }
    return CURRENCY_INFO[currency];
  }

  /**
   * Format amount with currency symbol
   */
  formatAmount(amount: number, currency: string): string {
    const info = this.getCurrencyInfo(currency);
    const formatted = this.roundToDecimalPlaces(amount, info.decimalPlaces);
    return `${formatted} ${info.symbol}`;
  }

  /**
   * Format amount with currency code
   */
  formatAmountWithCode(amount: number, currency: string): string {
    const info = this.getCurrencyInfo(currency);
    const formatted = this.roundToDecimalPlaces(amount, info.decimalPlaces);
    return `${formatted} ${info.code}`;
  }

  /**
   * Round amount to currency's decimal places
   */
  roundToDecimalPlaces(amount: number, decimalPlaces: number): number {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(amount * factor) / factor;
  }

  /**
   * Round amount according to currency's decimal places
   */
  roundForCurrency(amount: number, currency: string): number {
    const info = this.getCurrencyInfo(currency);
    return this.roundToDecimalPlaces(amount, info.decimalPlaces);
  }

  /**
   * Validate amount is within acceptable range
   */
  validateAmount(amount: number, currency: string, minAmount = 0.01): void {
    if (!Number.isFinite(amount) || amount < minAmount) {
      throw new BadRequestException(
        `Amount must be at least ${minAmount} ${currency}`,
      );
    }

    const info = this.getCurrencyInfo(currency);
    const rounded = this.roundToDecimalPlaces(amount, info.decimalPlaces);
    if (Math.abs(amount - rounded) > 0.0001) {
      throw new BadRequestException(
        `Amount precision exceeds ${info.decimalPlaces} decimal places for ${currency}`,
      );
    }
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): CurrencyInfo[] {
    return SUPPORTED_CURRENCIES.map((code) => CURRENCY_INFO[code]);
  }

  /**
   * Normalize currency code to uppercase
   */
  normalizeCurrency(currency: string): string {
    return currency.trim().toUpperCase();
  }
}
