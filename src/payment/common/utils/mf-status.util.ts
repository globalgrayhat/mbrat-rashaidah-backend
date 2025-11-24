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
]);
const FAILED_TX_KEYWORDS = new Set([
  'FAILED',
  'DECLINED',
  'VOID',
  'CANCELED',
  'CANCELLED',
]);

export function normalizeTxStatus(v: unknown): CanonicalTxStatus {
  if (v == null) return 'UNKNOWN';
  const s = String(v).trim().toUpperCase();
  if (PAID_TX_KEYWORDS.has(s)) return 'SUCCESS';
  if (FAILED_TX_KEYWORDS.has(s)) return 'FAILED';
  if (s === 'INPROGRESS') return 'INPROGRESS';
  if (s === 'AUTHORIZE' || s === 'AUTHORIZED' || s === 'AUTHORISED')
    return 'AUTHORIZE';
  if (s === 'CANCELED' || s === 'CANCELLED') return 'CANCELED';
  return 'UNKNOWN';
}

export function normalizeInvoiceStatus(v: unknown): CanonicalInvoiceStatus {
  if (v == null) return 'OTHER';
  if (typeof v === 'string') {
    const s = v.trim().toUpperCase();
    if (s === 'PAID') return 'PAID';
    if (s === 'PENDING') return 'PENDING';
    if (s === 'CANCELED' || s === 'CANCELLED') return 'CANCELED';
    return 'OTHER';
  }
  if (typeof v === 'number') {
    const n = v;
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

  if (tx.some((t) => t === 'SUCCESS')) return 'paid';

  if (tx.length > 0 && tx.every((t) => t === 'FAILED' || t === 'CANCELED')) {
    return 'failed';
  }

  const inv = normalizeInvoiceStatus(invoiceStatusUnknown);
  if (inv === 'PAID') return 'paid';
  if (inv === 'CANCELED') return 'failed';

  return 'pending';
}
