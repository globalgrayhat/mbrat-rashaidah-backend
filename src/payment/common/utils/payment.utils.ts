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
  localPaymentId: string;
  paymentId: string; // backward compatibility: local DB payment id
  paymentResult: PaymentResult;
}

function normalizePaymentStatus(status?: string): 'pending' | 'paid' | 'failed' {
  const s = String(status || '').toLowerCase().trim();

  if (['paid', 'success', 'successful', 'completed', 'captured'].includes(s)) {
    return 'paid';
  }

  if (
    ['failed', 'fail', 'failure', 'canceled', 'cancelled', 'expired', 'error'].includes(
      s,
    )
  ) {
    return 'failed';
  }

  return 'pending';
}

function extractMfPaymentId(paymentResult: PaymentResult): string | undefined {
  const raw = paymentResult.rawResponse as any;

  const value =
    (paymentResult as any).paymentId ||
    raw?.PaymentId ||
    raw?.Payments?.[0]?.PaymentId;

  return value ? String(value) : undefined;
}

export async function createLocalPaymentForEntityFromResult(
  paymentRepository: Repository<Payment>,
  input: {
    amount: number;
    currency: string;
    customerName?: string;
    customerEmail?: string;
    customerMobile?: string;
    paymentMethodId?: string | number;
  },
  paymentResult: PaymentResult,
): Promise<{ payment: Payment; paymentResult: PaymentResult }> {
  const mfPaymentId = extractMfPaymentId(paymentResult);

  const payment = paymentRepository.create({
    transactionId: String(paymentResult.id),
    mfPaymentId,
    status: normalizePaymentStatus(paymentResult.status),
    amount: input.amount,
    currency: input.currency,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerMobile: input.customerMobile,
    paymentMethod: input.paymentMethodId ? String(input.paymentMethodId) : '',
    paymentUrl: paymentResult.url,
    rawResponse: paymentResult.rawResponse,
  } as Partial<Payment>);

  const savedPayment = await paymentRepository.save(payment);

  return {
    payment: savedPayment,
    paymentResult,
  };
}

export async function createPaymentForEntity(
  paymentService: PaymentService,
  paymentRepository: Repository<Payment>,
  options: CreatePaymentOptions,
): Promise<CreatePaymentResult> {
  const payload = {
    amount: options.amount,
    currency: options.currency,
    referenceId: options.entityId,
    description: options.description,
    customerName: options.customerName,
    customerEmail: options.customerEmail,
    customerMobile: options.customerMobile,
    paymentMethodId:
      options.paymentMethodId !== undefined
        ? Number(options.paymentMethodId)
        : undefined,
    metadata: options.metadata,
  } as PaymentPayload & { paymentMethodId?: number };

  const paymentResult: PaymentResult =
    await paymentService.createPayment(payload);

  const { payment } = await createLocalPaymentForEntityFromResult(
    paymentRepository,
    {
      amount: options.amount,
      currency: options.currency,
      customerName: options.customerName,
      customerEmail: options.customerEmail,
      customerMobile: options.customerMobile,
      paymentMethodId: options.paymentMethodId,
    },
    paymentResult,
  );

  return {
    payment,
    paymentUrl: paymentResult.url || '',
    invoiceId: paymentResult.id,
    localPaymentId: payment.id,
    paymentId: payment.id,
    paymentResult,
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
