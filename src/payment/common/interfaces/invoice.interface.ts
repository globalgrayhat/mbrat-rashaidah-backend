/**
 * Invoice and InvoiceItem Interfaces
 *
 * These are read-only view models used to normalize and display
 * invoice/payment data from the database and MyFatoorah API.
 * They are NOT database entities — just clean response shapes.
 */

/**
 * Represents a single line item within an invoice.
 * Typically maps to a donation (project or campaign).
 */
export interface InvoiceItem {
  /** Display name (project title, campaign title, or "General Donation") */
  name: string;

  /** Item type: project, campaign, or other */
  type: 'project' | 'campaign' | 'other';

  /** Amount for this line item */
  amount: number;

  /** Percentage of total invoice amount (rounded to nearest integer) */
  percentage: number;
}

/**
 * Represents a fully normalized invoice for frontend display.
 * Combines data from local Payment entity + MyFatoorah API response.
 */
export interface Invoice {
  /** MyFatoorah Invoice ID (stored as Payment.transactionId) */
  invoiceId: string;

  /** Local Payment UUID */
  paymentId: string;

  /** Normalized status */
  status: 'pending' | 'paid' | 'failed';

  /** Outcome alias (same as status, for backward compatibility with frontend) */
  outcome: 'pending' | 'paid' | 'failed';

  /** Human-friendly status label */
  statusLabel: string;

  /** Total invoice amount */
  totalAmount: number;

  /** Currency ISO code (e.g., "KWD") */
  currency: string;

  /** Itemized breakdown of the invoice */
  items: InvoiceItem[];

  /** Customer information */
  customer: {
    name?: string;
    email?: string;
    mobile?: string;
  };

  /** Transaction date (YYYY-MM-DD) */
  date: string;

  /** Transaction time (HH:MM:SS) */
  time: string;

  /** Payment provider name (e.g., "myfatoorah") */
  provider: string;

  /** MyFatoorah-specific PaymentId (if available) */
  mfPaymentId?: string;

  /** Payment method used (e.g., "KNET", "VISA") */
  paymentMethod?: string;

  /** ISO timestamp of last update */
  updatedAt: string;
}
