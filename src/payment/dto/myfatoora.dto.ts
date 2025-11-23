/**
 * DTO for creating a payment invoice via MyFatoorah's SendPayment endpoint.
 * Reference: https://docs.myfatoorah.com/docs/payment-methods
 */

export class SendPaymentDto {
  /** Customer name to be shown on the invoice */
  CustomerName: string;

  /**
   * Where to send the invoice link:
   * - LNK: only return link in response
   * - EML: send by email
   * - SMS: send by SMS
   * - ALL: send by both and return link
   */
  NotificationOption: 'LNK' | 'EML' | 'SMS' | 'ALL';

  /** Amount to be paid (must match InvoiceItems if provided) */
  InvoiceValue: number;

  /** ISO currency code like KWD, USD, etc. */
  DisplayCurrencyIso?: string;

  /** Required if NotificationOption is SMS or ALL */
  CustomerMobile?: string;

  /** Required if NotificationOption is EML or ALL */
  CustomerEmail?: string;

  /** 2-letter country code for mobile (e.g. 965 for Kuwait) */
  MobileCountryCode?: string;

  /** URL to redirect after successful payment */
  CallBackUrl?: string;

  /** URL to redirect after failed payment */
  ErrorUrl?: string;

  /** Language of the payment page: AR or EN */
  Language?: 'AR' | 'EN';

  /** Your internal reference ID (e.g. donation ID) */
  CustomerReference?: string;

  /** Civil ID of customer (optional) */
  CustomerCivilId?: string;

  /** Optional custom metadata or identifier */
  UserDefinedField?: string;

  /** Address of the customer */
  CustomerAddress?: {
    Block?: string;
    Street?: string;
    HouseBuildingNo?: string;
    Address?: string;
    AddressInstructions?: string;
  };

  /** Optional list of invoice items (if you want item breakdown) */
  InvoiceItems?: {
    ItemName: string;
    Quantity: number;
    UnitPrice: number;
    Weight?: number;
    Width?: number;
    Height?: number;
    Depth?: number;
  }[];

  /** Invoice expiry (ISO timestamp format) */
  ExpiryDate?: string;

  /** Shipping invoice support */
  ShippingMethod?: number;

  ShippingConsignee?: {
    PersonName: string;
    Mobile: string;
    EmailAddress?: string;
    LineAddress: string;
    CityName: string;
    PostalCode?: string;
    CountryCode: string;
  };

  /** For multi-vendor invoices */
  Suppliers?: {
    SupplierCode: number;
    ProposedShare?: number;
    InvoiceShare: number;
  }[];

  /** Webhook override */
  WebhookUrl?: string;

  /** Payment method override (KNET, VISA, ApplePay, etc.) */
  InvoicePaymentMethods?: number[];

  /** Optional auto capture or not */
  ProcessingDetails?: {
    AutoCapture: boolean;
  };
}
