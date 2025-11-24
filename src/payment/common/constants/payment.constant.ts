/**
 * Payment Method Enum (Legacy/Deprecated)
 *
 * NOTE: This enum is kept for backward compatibility and fallback purposes only.
 * The system now accepts ANY payment method ID from providers (MyFatoorah, Stripe, PayMob, etc.)
 * without restriction. Payment methods are stored as strings/numbers in the database
 * to support provider-specific IDs that may change over time.
 *
 * Payment providers return their own payment method IDs (e.g., MyFatoorah returns 24 for Apple Pay,
 * not 8 as defined here). The system uses provider data directly without mapping to this enum.
 *
 * @deprecated Use provider-specific payment method IDs directly. This enum is only used for fallback.
 */
export enum PaymentMethodEnum {
  KNET = 1,
  VISA = 2,
  AMEX = 3,
  BENEFIT = 4,
  MADA = 5,
  UAE_DEBIT = 6,
  QATAR_DEBIT = 7,
  APPLE_PAY = 8,
  GOOGLE_PAY = 9,
  STC_PAY = 10,
  OMAN_NET = 11,
  MOBILE_WALLET_EGYPT = 12,
  MEEZA = 13,
}

/**
 * Payment method metadata with English and Arabic names
 */
export interface PaymentMethodInfo {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
  isDirectPayment: boolean;
  imageUrl?: string;
}

/**
 * Mapping of payment method IDs to their metadata (Legacy/Deprecated)
 *
 * NOTE: This mapping is kept for backward compatibility and fallback purposes only.
 * The system now uses payment method data directly from providers (MyFatoorah, Stripe, PayMob, etc.)
 * without mapping to this static list. This ensures the system is flexible and provider-agnostic.
 *
 * This mapping is only used as a fallback when the payment provider API is unavailable.
 *
 * @deprecated Use provider-specific payment method data directly. This mapping is only used for fallback.
 */
export const PAYMENT_METHOD_INFO: Record<number, PaymentMethodInfo> = {
  [PaymentMethodEnum.KNET]: {
    id: PaymentMethodEnum.KNET,
    code: 'KNET',
    nameEn: 'KNET',
    nameAr: 'كي نت',
    isDirectPayment: false,
  },
  [PaymentMethodEnum.VISA]: {
    id: PaymentMethodEnum.VISA,
    code: 'VISA',
    nameEn: 'VISA/MASTER',
    nameAr: 'فيزا / ماستر',
    isDirectPayment: false,
  },
  [PaymentMethodEnum.AMEX]: {
    id: PaymentMethodEnum.AMEX,
    code: 'AMEX',
    nameEn: 'AMEX',
    nameAr: 'اميكس',
    isDirectPayment: false,
  },
  [PaymentMethodEnum.BENEFIT]: {
    id: PaymentMethodEnum.BENEFIT,
    code: 'BENEFIT',
    nameEn: 'Benefit',
    nameAr: 'بنفت',
    isDirectPayment: false,
  },
  [PaymentMethodEnum.MADA]: {
    id: PaymentMethodEnum.MADA,
    code: 'MADA',
    nameEn: 'MADA',
    nameAr: 'مدى',
    isDirectPayment: false,
  },
  [PaymentMethodEnum.UAE_DEBIT]: {
    id: PaymentMethodEnum.UAE_DEBIT,
    code: 'UAE_DEBIT',
    nameEn: 'UAE Debit Cards',
    nameAr: 'كروت الدفع المدينة (الامارات)',
    isDirectPayment: false,
  },
  [PaymentMethodEnum.QATAR_DEBIT]: {
    id: PaymentMethodEnum.QATAR_DEBIT,
    code: 'QATAR_DEBIT',
    nameEn: 'Qatar Debit Cards',
    nameAr: 'كروت الدفع المدينة (قطر)',
    isDirectPayment: false,
  },
  [PaymentMethodEnum.APPLE_PAY]: {
    id: PaymentMethodEnum.APPLE_PAY,
    code: 'APPLE_PAY',
    nameEn: 'Apple Pay',
    nameAr: 'ابل باي',
    isDirectPayment: true,
  },
  [PaymentMethodEnum.GOOGLE_PAY]: {
    id: PaymentMethodEnum.GOOGLE_PAY,
    code: 'GOOGLE_PAY',
    nameEn: 'Google Pay',
    nameAr: 'جوجل باي',
    isDirectPayment: true,
  },
  [PaymentMethodEnum.STC_PAY]: {
    id: PaymentMethodEnum.STC_PAY,
    code: 'STC_PAY',
    nameEn: 'STC Pay',
    nameAr: 'STC Pay',
    isDirectPayment: false,
  },
  [PaymentMethodEnum.OMAN_NET]: {
    id: PaymentMethodEnum.OMAN_NET,
    code: 'OMAN_NET',
    nameEn: 'Oman Net',
    nameAr: 'عمان نت',
    isDirectPayment: false,
  },
  [PaymentMethodEnum.MOBILE_WALLET_EGYPT]: {
    id: PaymentMethodEnum.MOBILE_WALLET_EGYPT,
    code: 'MOBILE_WALLET_EGYPT',
    nameEn: 'Mobile Wallet (Egypt)',
    nameAr: 'محفظة إلكترونية (مصر)',
    isDirectPayment: false,
  },
  [PaymentMethodEnum.MEEZA]: {
    id: PaymentMethodEnum.MEEZA,
    code: 'MEEZA',
    nameEn: 'Meeza',
    nameAr: 'ميزة',
    isDirectPayment: false,
  },
};

/**
 * Get payment method info by ID (Legacy/Deprecated)
 *
 * NOTE: This function is kept for backward compatibility and fallback purposes only.
 * The system now uses payment method data directly from providers without mapping.
 *
 * @deprecated Use provider-specific payment method data directly.
 */
export function getPaymentMethodInfo(
  methodId: number,
): PaymentMethodInfo | undefined {
  return PAYMENT_METHOD_INFO[methodId];
}

/**
 * Check if a payment method ID is supported (Legacy/Deprecated)
 *
 * NOTE: This function always returns true now, as the system accepts any payment method
 * from providers. Payment method validation is handled by the payment provider itself.
 *
 * @deprecated Payment methods are provider-specific and validated by the provider.
 */
export function isSupportedPaymentMethod(methodId: number): boolean {
  // Always return true - providers handle their own payment method validation
  return true;
}

export enum PaymentGatewayStatus {
  SUCCESS = 4, // MyFatoorah paid status example
  FAILED = 1, // MyFatoorah failed status example
  PENDING = 0, // Custom pending status
  // Add other relevant statuses as needed per gateway
}
export type MFKeyType = 'InvoiceId' | 'PaymentId' | 'CustomerReference';
