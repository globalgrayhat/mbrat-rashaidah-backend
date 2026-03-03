/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Payment Utility Functions
 *
 * This file contains essential utility functions for working with the Payment module.
 * These functions provide a clean, reusable interface for common payment operations
 * and can be used with any payment provider (MyFatoorah, Stripe, PayMob, etc.).
 *
 * These utilities are generic and can be used with any entity type:
 * - Orders (e-commerce)
 * - Donations (charity)
 * - Subscriptions (SaaS)
 * - Courses (education)
 * - Any other entity that requires payment
 *
 * ## Features
 *
 * - Provider-agnostic: Works with any payment provider
 * - Entity-agnostic: Works with any entity type (orders, donations, subscriptions, etc.)
 * - Type-safe: Full TypeScript support
 * - Reusable: Can be used across different projects
 * - Well-documented: Clear examples and documentation
 *
 * ## Usage
 *
 * ```typescript
 * import { createPaymentForEntity, handlePaymentWebhook } from './payment.utils';
 *
 * // Create payment for any entity
 * const result = await createPaymentForEntity(paymentService, paymentRepository, {
 *   entityId: 'order-123', // or 'donation-123', 'subscription-123', etc.
 *   amount: 100,
 *   currency: 'KWD',
 *   // ...
 * });
 *
 * // Handle webhook
 * await handlePaymentWebhook(paymentService, paymentRepository, invoiceId, {
 *   onPaid: async (payment) => {
 *     // Update entity status
 *   }
 * });
 * ```
 */

import { Repository } from 'typeorm';
import { PaymentService } from '../../payment.service';
import { Payment } from '../../entities/payment.entity';
import {
  PaymentPayload,
  PaymentResult,
} from '../interfaces/payment-service.interface';
import { PaymentStatusResult } from '../interfaces/payment-provider.interface';
import { PaymentProviderType } from '../interfaces/payment-provider.interface';

/**
 * Payment creation options
 * Generic options that work with any entity type (orders, donations, subscriptions, etc.)
 */
export interface CreatePaymentOptions {
  /**
   * Entity ID to link payment to (orderId, donationId, subscriptionId, etc.)
   */
  entityId: string;

  /**
   * Payment amount
   */
  amount: number;

  /**
   * Currency code (e.g., 'KWD', 'USD', 'EUR')
   */
  currency: string;

  /**
   * Payment description
   */
  description: string;

  /**
   * Customer name
   */
  customerName: string;

  /**
   * Customer email (optional)
   */
  customerEmail?: string;

  /**
   * Customer mobile (optional)
   */
  customerMobile?: string;

  /**
   * Payment method ID from provider (optional)
   * If not provided, user will select from available methods
   */
  paymentMethodId?: string | number;

  /**
   * Specific provider to use (optional)
   * If not provided, uses active provider
   */
  provider?: PaymentProviderType;

  /**
   * Additional metadata (optional)
   */
  metadata?: Record<string, any>;
}

/**
 * Payment creation result
 */
export interface CreatePaymentResult {
  /**
   * Payment entity saved in database
   */
  payment: Payment;

  /**
   * Payment URL to redirect user to
   */
  paymentUrl: string;

  /**
   * Provider transaction ID (InvoiceId, PaymentIntentId, etc.)
   */
  invoiceId: string;

  /**
   * Payment ID (database UUID)
   */
  paymentId: string;
}

/**
 * Webhook handler callbacks
 */
export interface WebhookCallbacks {
  /**
   * Called when payment is successful
   */
  onPaid?: (
    payment: Payment,
    statusResult: PaymentStatusResult,
  ) => Promise<void>;

  /**
   * Called when payment fails
   */
  onFailed?: (
    payment: Payment,
    statusResult: PaymentStatusResult,
  ) => Promise<void>;

  /**
   * Called when payment is still pending
   */
  onPending?: (
    payment: Payment,
    statusResult: PaymentStatusResult,
  ) => Promise<void>;
}

/**
 * Create a payment for any entity (order, donation, subscription, etc.)
 *
 * This is the main function for creating payments. It:
 * 1. Creates payment via PaymentService
 * 2. Saves Payment entity to database
 * 3. Returns payment URL and IDs
 *
 * This function is generic and works with any entity type:
 * - Orders (e-commerce)
 * - Donations (charity)
 * - Subscriptions (SaaS)
 * - Courses (education)
 * - Any other entity that requires payment
 *
 * @param paymentService PaymentService instance
 * @param paymentRepository Payment repository
 * @param options Payment creation options
 * @returns Payment creation result
 *
 * @example
 * ```typescript
 * // For orders
 * const result = await createPaymentForEntity(
 *   paymentService,
 *   paymentRepository,
 *   {
 *     entityId: 'order-123',
 *     amount: 100,
 *     currency: 'KWD',
 *     description: 'Order #123',
 *     customerName: 'John Doe',
 *     customerEmail: 'john@example.com',
 *     paymentMethodId: '1', // KNET
 *     metadata: { entityType: 'order' },
 *   }
 * );
 *
 * // For donations
 * const result = await createPaymentForEntity(
 *   paymentService,
 *   paymentRepository,
 *   {
 *     entityId: 'donation-123',
 *     amount: 50,
 *     currency: 'KWD',
 *     description: 'Donation for Project X',
 *     customerName: 'Jane Doe',
 *     customerEmail: 'jane@example.com',
 *     metadata: { entityType: 'donation' },
 *   }
 * );
 *
 * // Redirect user to payment URL
 * return { redirectUrl: result.paymentUrl };
 * ```
 */
export async function createPaymentForEntity(
  paymentService: PaymentService,
  paymentRepository: Repository<Payment>,
  options: CreatePaymentOptions,
): Promise<CreatePaymentResult> {
  // 1. Create payment payload
  const payload: PaymentPayload & { paymentMethodId?: string | number } = {
    amount: options.amount,
    currency: options.currency,
    referenceId: options.entityId, // Generic entity ID
    description: options.description,
    customerName: options.customerName,
    customerEmail: options.customerEmail,
    customerMobile: options.customerMobile,
    paymentMethodId: options.paymentMethodId,
    metadata: {
      entityType: options.metadata?.entityType || 'entity', // Generic entity type
      ...options.metadata,
    },
  };

  // 2. Create payment via PaymentService
  const paymentResult: PaymentResult = await paymentService.createPayment(
    payload,
    options.provider,
  );

  // 3. Create Payment entity
  const payment = paymentRepository.create({
    transactionId: paymentResult.id, // Provider transaction ID
    amount: options.amount,
    currency: options.currency,
    paymentMethod: options.paymentMethodId
      ? String(options.paymentMethodId)
      : 'unknown',
    status: paymentResult.status, // 'pending'
    paymentUrl: paymentResult.url,
    rawResponse: paymentResult.rawResponse,
  });

  // 4. Save Payment entity
  const savedPayment = await paymentRepository.save(payment);

  return {
    payment: savedPayment,
    paymentUrl: paymentResult.url || '',
    invoiceId: paymentResult.id,
    paymentId: savedPayment.id,
  };
}

/**
 * Handle payment webhook
 *
 * This function handles payment webhooks from providers. It:
 * 1. Finds payment by transaction ID
 * 2. Gets latest status from provider
 * 3. Updates payment status
 * 4. Calls appropriate callback based on status
 *
 * @param paymentService PaymentService instance
 * @param paymentRepository Payment repository
 * @param invoiceId Provider transaction ID (InvoiceId, PaymentIntentId, etc.)
 * @param callbacks Webhook callbacks (onPaid, onFailed, onPending)
 * @returns Webhook handling result
 *
 * @example
 * ```typescript
 * await handlePaymentWebhook(
 *   paymentService,
 *   paymentRepository,
 *   invoiceId,
 *   {
 *     onPaid: async (payment, statusResult) => {
 *       // Update order status to paid
 *       await orderRepository.update(
 *         { paymentId: payment.id },
 *         { status: 'paid', paidAt: new Date() }
 *       );
 *     },
 *     onFailed: async (payment, statusResult) => {
 *       // Update order status to failed
 *       await orderRepository.update(
 *         { paymentId: payment.id },
 *         { status: 'failed' }
 *       );
 *     },
 *   }
 * );
 * ```
 */
export async function handlePaymentWebhook(
  paymentService: PaymentService,
  paymentRepository: Repository<Payment>,
  invoiceId: string,
  callbacks?: WebhookCallbacks,
): Promise<{
  success: boolean;
  paymentId: string;
  status: string;
}> {
  // 1. Find payment by transaction ID
  const payment = await paymentRepository.findOne({
    where: { transactionId: invoiceId },
  });

  if (!payment) {
    throw new Error(`Payment not found for invoice: ${invoiceId}`);
  }

  // 2. Get latest status from provider
  const statusResult = await paymentService.getPaymentStatus(invoiceId);

  // 3. Update payment status
  payment.status = statusResult.outcome; // 'paid', 'failed', or 'pending'
  await paymentRepository.save(payment);

  // 4. Call appropriate callback
  if (statusResult.outcome === 'paid' && callbacks?.onPaid) {
    await callbacks.onPaid(payment, statusResult);
  } else if (statusResult.outcome === 'failed' && callbacks?.onFailed) {
    await callbacks.onFailed(payment, statusResult);
  } else if (statusResult.outcome === 'pending' && callbacks?.onPending) {
    await callbacks.onPending(payment, statusResult);
  }

  return {
    success: true,
    paymentId: payment.id,
    status: statusResult.outcome,
  };
}

/**
 * Reconcile payment status manually
 *
 * This function manually checks payment status with the provider.
 * Useful for:
 * - On-demand status checks
 * - Cron jobs
 * - Admin actions
 *
 * @param paymentService PaymentService instance
 * @param paymentRepository Payment repository
 * @param paymentId Payment ID (database UUID) or transaction ID
 * @param callbacks Optional callbacks for status changes
 * @returns Reconciliation result
 *
 * @example
 * ```typescript
 * const result = await reconcilePayment(
 *   paymentService,
 *   paymentRepository,
 *   paymentId,
 *   {
 *     onPaid: async (payment) => {
 *       await updateOrderStatus(payment.id, 'paid');
 *     },
 *   }
 * );
 * ```
 */
export async function reconcilePayment(
  paymentService: PaymentService,
  paymentRepository: Repository<Payment>,
  paymentId: string,
  callbacks?: WebhookCallbacks,
): Promise<{
  paymentId: string;
  status: string;
  updated: boolean;
}> {
  // 1. Find payment (try by ID first, then by transactionId)
  let payment = await paymentRepository.findOne({
    where: { id: paymentId },
  });

  if (!payment) {
    payment = await paymentRepository.findOne({
      where: { transactionId: paymentId },
    });
  }

  if (!payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }

  // 2. Get latest status from provider
  const statusResult = await paymentService.getPaymentStatus(
    payment.transactionId,
  );

  // 3. Check if status changed
  const statusChanged = payment.status !== statusResult.outcome;

  // 4. Update payment status if changed
  if (statusChanged) {
    payment.status = statusResult.outcome;
    await paymentRepository.save(payment);

    // 5. Call appropriate callback
    if (statusResult.outcome === 'paid' && callbacks?.onPaid) {
      await callbacks.onPaid(payment, statusResult);
    } else if (statusResult.outcome === 'failed' && callbacks?.onFailed) {
      await callbacks.onFailed(payment, statusResult);
    } else if (statusResult.outcome === 'pending' && callbacks?.onPending) {
      await callbacks.onPending(payment, statusResult);
    }
  }

  return {
    paymentId: payment.id,
    status: statusResult.outcome,
    updated: statusChanged,
  };
}

/**
 * Get available payment methods
 *
 * Fetches available payment methods from the provider for a given amount and currency.
 *
 * @param paymentService PaymentService instance
 * @param amount Payment amount
 * @param currency Currency code
 * @param provider Optional provider type (uses active provider if not specified)
 * @returns Available payment methods
 *
 * @example
 * ```typescript
 * const methods = await getAvailablePaymentMethods(
 *   paymentService,
 *   100,
 *   'KWD',
 *   'myfatoorah'
 * );
 *
 * // Display methods to user
 * methods.paymentMethods.forEach(method => {
 *   console.log(`${method.nameEn} - ${method.totalAmount} ${method.currency}`);
 * });
 * ```
 */
export async function getAvailablePaymentMethods(
  paymentService: PaymentService,
  amount: number,
  currency: string,
  provider?: PaymentProviderType,
) {
  return await paymentService.getAvailablePaymentMethods(
    amount,
    currency,
    provider,
  );
}

/**
 * Check payment provider health
 *
 * Checks if a payment provider is healthy and configured.
 *
 * @param paymentService PaymentService instance
 * @param provider Optional provider type (checks all if not specified)
 * @returns Health check result
 *
 * @example
 * ```typescript
 * // Check specific provider
 * const health = await checkProviderHealth(paymentService, 'myfatoorah');
 * if (health.status === 'healthy') {
 *   console.log('Provider is ready');
 * }
 *
 * // Check all providers
 * const allHealth = await checkProviderHealth(paymentService);
 * ```
 */
export async function checkProviderHealth(
  paymentService: PaymentService,
  provider?: PaymentProviderType,
) {
  return await paymentService.healthCheck(provider);
}

/**
 * Get payment by ID or transaction ID
 *
 * Helper function to find payment by either database ID or provider transaction ID.
 *
 * @param paymentRepository Payment repository
 * @param id Payment ID (database UUID) or transaction ID
 * @returns Payment entity or null
 *
 * @example
 * ```typescript
 * const payment = await getPaymentById(paymentRepository, paymentId);
 * if (payment) {
 *   console.log(`Payment status: ${payment.status}`);
 * }
 * ```
 */
export async function getPaymentById(
  paymentRepository: Repository<Payment>,
  id: string,
): Promise<Payment | null> {
  // Try by database ID first
  let payment = await paymentRepository.findOne({
    where: { id },
  });

  // If not found, try by transaction ID
  if (!payment) {
    payment = await paymentRepository.findOne({
      where: { transactionId: id },
    });
  }

  return payment;
}

/**
 * Get payments by status
 *
 * Fetches all payments with a specific status.
 *
 * @param paymentRepository Payment repository
 * @param status Payment status ('paid', 'failed', 'pending')
 * @returns Array of payments
 *
 * @example
 * ```typescript
 * const pendingPayments = await getPaymentsByStatus(
 *   paymentRepository,
 *   'pending'
 * );
 * ```
 */
export async function getPaymentsByStatus(
  paymentRepository: Repository<Payment>,
  status: string,
): Promise<Payment[]> {
  return await paymentRepository.find({
    where: { status },
    order: { createdAt: 'DESC' },
  });
}

/**
 * Get payments for an entity (order, donation, subscription, etc.)
 *
 * Fetches all payments linked to a specific entity.
 * Searches in rawResponse metadata or transactionId.
 *
 * @param paymentRepository Payment repository
 * @param entityId Entity ID (orderId, donationId, subscriptionId, etc.)
 * @param referenceType Optional reference type (e.g., 'order', 'donation', 'subscription')
 * @returns Array of payments
 *
 * @example
 * ```typescript
 * // Get payments for an order
 * const payments = await getPaymentsForEntity(
 *   paymentRepository,
 *   orderId,
 *   'order'
 * );
 *
 * // Get payments for a donation
 * const payments = await getPaymentsForEntity(
 *   paymentRepository,
 *   donationId,
 *   'donation'
 * );
 * ```
 */
export async function getPaymentsForEntity(
  paymentRepository: Repository<Payment>,
  entityId: string,
  referenceType?: string,
): Promise<Payment[]> {
  // Note: Payment entity doesn't have referenceType/referenceId by default
  // You can add these fields to Payment entity if needed, or use this fallback approach

  // Fallback: search by transactionId or in rawResponse metadata
  // This searches for entityId in the rawResponse JSON
  return await paymentRepository
    .createQueryBuilder('payment')
    .where('CAST(payment.rawResponse AS CHAR) LIKE :entityId', {
      entityId: `%${entityId}%`,
    })
    .orWhere('payment.transactionId = :entityId', { entityId })
    .orderBy('payment.createdAt', 'DESC')
    .getMany();

  // Alternative: If you add referenceType and referenceId to Payment entity:
  // if (referenceType) {
  //   return await paymentRepository.find({
  //     where: {
  //       referenceType,
  //       referenceId: entityId,
  //     } as any,
  //     order: { createdAt: 'DESC' },
  //   });
  // }
}

// Export alias for backward compatibility
export const createPaymentForOrder = createPaymentForEntity;
export const getPaymentsForOrder = getPaymentsForEntity;
