export interface PaymentResult {
  id: string;
  url: string;
  status: string;
  [key: string]: any;
}

export interface PaymentPayload {
  amount: number;
  currency: string;
  donationId: string;
  description: string;
  customerName?: string;
  customerEmail?: string;
  mobileCountryCode?: string;
  customerMobile?: string;
}

export interface MyFatooraEvent {
  body: {
    InvoiceId: string;
    TransactionStatus: string;
  };
}
