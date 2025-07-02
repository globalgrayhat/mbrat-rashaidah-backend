import { PaymentResult } from '../interfaces/payment-service.interface';

export interface PaymentProvider {
  // createPayment(input: PaymentCreateDto): Promise<PaymentResult>;
  handleWebhook(event: any): Promise<PaymentResult>;
  getStatus(id: string): Promise<PaymentResult>;
}
