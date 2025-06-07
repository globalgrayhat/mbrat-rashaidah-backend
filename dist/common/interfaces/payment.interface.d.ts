export interface PaymentResult {
    id: string;
    url: string;
    status: string;
    [key: string]: any;
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
