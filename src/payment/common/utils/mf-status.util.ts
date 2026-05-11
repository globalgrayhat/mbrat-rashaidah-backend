/* eslint-disable @typescript-eslint/no-base-to-string */
export type MFOutcome = 'paid' | 'failed' | 'pending';

export type CanonicalInvoiceStatus = 'PENDING' | 'PAID' | 'CANCELED' | 'OTHER';
export type CanonicalTxStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELED'
  | 'INPROGRESS'
  | 'AUTHORIZE'
  | 'UNKNOWN';

const PAID_TX_KEYWORDS = new Set([
  'SUCCESS',
  'SUCCSS',
  'CAPTURED',
  'PAID',
  'APPROVED',
  'COMPLETED',
  'DONE',
]);
const FAILED_TX_KEYWORDS = new Set([
  'FAILED',
  'DECLINED',
  'VOID',
  'CANCELED',
  'CANCELLED',
]);
const PENDING_TX_KEYWORDS = new Set([
  'INPROGRESS',
  'PENDING',
  'INITIATED',
  'AUTHORIZE',
  'AUTHORIZED',
  'AUTHORISED',
]);

export function normalizeTxStatus(v: unknown): CanonicalTxStatus {
  console.log('[DEBUG] normalizeTxStatus input:', { value: v, type: typeof v });
  if (v == null) return 'UNKNOWN';
  const s = String(v).trim().toUpperCase();
  console.log('[DEBUG] normalizeTxStatus string:', s);
  if (PAID_TX_KEYWORDS.has(s)) return 'SUCCESS';
  if (FAILED_TX_KEYWORDS.has(s)) return 'FAILED';
  if (PENDING_TX_KEYWORDS.has(s)) return 'INPROGRESS';
  if (s === 'CANCELED' || s === 'CANCELLED') return 'CANCELED';
  return 'UNKNOWN';
}

export function normalizeInvoiceStatus(v: unknown): CanonicalInvoiceStatus {
  console.log('[DEBUG] normalizeInvoiceStatus input:', {
    value: v,
    type: typeof v,
  });

  if (v == null) return 'OTHER';
  if (typeof v === 'string') {
    const s = v.trim().toUpperCase();
    console.log('[DEBUG] normalizeInvoiceStatus string:', s);
    if (s === 'PAID' || s === 'PAIDONLINE' || s === 'CAPTURED' || s === 'SUCCESS' || s === 'SUCCSS') return 'PAID';
    if (s === 'PENDING' || s === 'EXPIRED' || s === 'INPROGRESS' || s === 'WAITING') return 'PENDING';
    if (s === 'CANCELED' || s === 'CANCELLED' || s === 'FAILED' || s === 'DECLINED' || s === 'VOID') return 'CANCELED';
    return 'OTHER';
  }
  if (typeof v === 'number') {
    const n = v;
    console.log('[DEBUG] normalizeInvoiceStatus number:', n);
    if ([2, 4].includes(n)) return 'PAID';
    if ([1, 5].includes(n)) return 'CANCELED';
    if ([0, 3].includes(n)) return 'PENDING';
    return 'OTHER';
  }
  return 'OTHER';
}

export function deriveOutcome(
  invoiceStatusUnknown: unknown,
  paymentStatusesUnknown: unknown[] = [],
): MFOutcome {
  const tx = paymentStatusesUnknown.map(normalizeTxStatus);

  console.log('[DEBUG] deriveOutcome:', {
    invoiceStatusUnknown,
    paymentStatusesUnknown,
    tx,
  });

  if (tx.some((t) => t === 'SUCCESS')) return 'paid';

  if (tx.length > 0 && tx.every((t) => t === 'FAILED' || t === 'CANCELED')) {
    return 'failed';
  }

  if (tx.some((t) => t === 'INPROGRESS' || t === 'AUTHORIZE')) {
    return 'pending';
  }

  const inv = normalizeInvoiceStatus(invoiceStatusUnknown);
  console.log('[DEBUG] deriveOutcome normalized invoice status:', inv);

  if (inv === 'PAID') return 'paid';
  if (inv === 'CANCELED') return 'failed';

  return 'pending';
}
