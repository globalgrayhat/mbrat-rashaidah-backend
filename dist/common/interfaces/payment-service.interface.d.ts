export interface PaymentCreateInput {
    amount: number;
    currency: string;
    donationId: string;
    projectTitle: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    metadata?: Record<string, any>;
}
export interface PaymentResult {
    id: string;
    status: PaymentStatus;
    url?: string;
    amount?: number;
    currency?: string;
    paymentMethod?: PaymentMethod;
    metadata?: Record<string, any>;
}
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type PaymentMethod = 'STRIPE' | 'MYFATOORA';
export interface WebhookData {
    PaymentId: string;
    Amount: number;
    Currency: string;
    TransactionStatus: string;
    Error?: string;
    InvoiceId?: number;
}
export interface StripeEvent {
    type: string;
    data: {
        object: {
            id: string;
            payment_status: string;
            status: string;
        };
    };
}
export interface MyFatooraEvent {
    body: {
        InvoiceId: string;
        TransactionStatus: string;
    };
}
