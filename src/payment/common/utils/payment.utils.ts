import { Repository } from 'typeorm';
import { PaymentService } from '../../payment.service';
import { Payment } from '../../entities/payment.entity';
import {
  PaymentPayload,
  PaymentResult,
} from '../interfaces/payment-service.interface';

export interface CreatePaymentOptions {
  entityId: string;
  amount: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail?: string;
  customerMobile?: string;
  paymentMethodId?: string | number;
  metadata?: Record<string, any>;
}

export interface CreatePaymentResult {
  payment: Payment;
  paymentUrl: string;
  invoiceId: string;
  paymentId: string;
}

export async function createPaymentForEntity(
  paymentService: PaymentService,
  paymentRepository: Repository<Payment>,
  options: CreatePaymentOptions,
): Promise<CreatePaymentResult> {
  const payload: PaymentPayload = {
    amount: options.amount,
    currency: options.currency,
    referenceId: options.entityId,
    description: options.description,
    customerName: options.customerName,
    customerEmail: options.customerEmail,
    customerMobile: options.customerMobile,
    metadata: options.metadata,
  };

  const paymentResult: PaymentResult =
    await paymentService.createPayment(payload);

  const payment = paymentRepository.create({
    transactionId: paymentResult.id,
    amount: options.amount,
    currency: options.currency,
    paymentMethod: options.paymentMethodId
      ? String(options.paymentMethodId)
      : 'unknown',
    status: paymentResult.status,
    paymentUrl: paymentResult.url,
    rawResponse: paymentResult.rawResponse,
    customerName: options.customerName,
    customerEmail: options.customerEmail,
    customerMobile: options.customerMobile,
  });

  const savedPayment = await paymentRepository.save(payment);

  return {
    payment: savedPayment,
    paymentUrl: paymentResult.url || '',
    invoiceId: paymentResult.id,
    paymentId: savedPayment.id,
  };
}

export async function getPaymentById(
  paymentRepository: Repository<Payment>,
  id: string,
): Promise<Payment | null> {
  let payment = await paymentRepository.findOne({ where: { id } });
  if (!payment) {
    payment = await paymentRepository.findOne({ where: { transactionId: id } });
  }
  return payment;
}

export async function getPaymentsByStatus(
  paymentRepository: Repository<Payment>,
  status: string,
): Promise<Payment[]> {
  return paymentRepository.find({
    where: { status },
    order: { createdAt: 'DESC' },
  });
}

export const createPaymentForOrder = createPaymentForEntity;
export const getPaymentsForOrder = getPaymentById;
