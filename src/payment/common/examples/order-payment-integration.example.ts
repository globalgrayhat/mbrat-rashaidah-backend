/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Order Payment Integration Examples
 *
 * This file contains practical examples for integrating the Payment module
 * with different types of orders (Products, Courses, Subscriptions, etc.).
 *
 * These examples are reusable and can be adapted for any project.
 *
 * ## Usage
 *
 * Copy the relevant example to your service and adapt it to your entity structure.
 *
 * ## Examples Included
 *
 * 1. **E-commerce Order (Products)**: Payment for product purchases
 * 2. **Course Order**: Payment for course enrollments
 * 3. **Subscription Order**: Payment for recurring subscriptions
 *
 * ## Key Concepts
 *
 * - **referenceId**: Generic identifier linking payment to your entity (orderId, courseId, etc.)
 * - **Payment Entity**: Stores payment transaction details independently
 * - **Webhook Handling**: Automatic payment status updates via webhooks
 * - **Reconciliation**: Manual/automatic payment status verification
 */

import {
  Injectable,
  //   BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm'; // EntityManager added later
import { PaymentService } from '../../payment.service';
import { Payment } from '../../entities/payment.entity';
import {
  createPaymentForEntity,
  //   handlePaymentWebhook,
  reconcilePayment,
  //   CreatePaymentOptions,
  //   CreatePaymentResult,
  //   WebhookCallbacks,
} from '../utils/payment.utils';

// ============================================================================
// EXAMPLE 1: E-COMMERCE ORDER (PRODUCTS)
// ============================================================================

/**
 * Example: Product Order Entity
 *
 * This represents an order for purchasing products in an e-commerce system.
 */
interface ProductOrder {
  id: string;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  paymentId?: string;
  paymentStatus?: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  customerId: string;
  customerEmail: string;
  customerName: string;
  createdAt: Date;
  paidAt?: Date;
}

/**
 * Example: Product Order Service
 *
 * This service demonstrates how to integrate payment with product orders.
 *
 * ## Steps:
 * 1. Create order entity
 * 2. Create payment using PaymentService
 * 3. Link payment to order
 * 4. Handle webhook updates
 * 5. Reconcile payment status
 */
@Injectable()
export class ProductOrderPaymentExample {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
    // Add your order repository here
    // @InjectRepository(ProductOrder)
    // private readonly orderRepository: Repository<ProductOrder>,
  ) {}

  /**
   * Create a product order with payment
   *
   * @param orderData Order data including items, customer info, etc.
   * @returns Order with payment URL
   *
   * @example
   * ```typescript
   * const order = await productOrderService.createOrder({
   *   items: [
   *     { productId: 'prod-123', quantity: 2, price: 50 },
   *     { productId: 'prod-456', quantity: 1, price: 30 },
   *   ],
   *   customerId: 'user-123',
   *   customerEmail: 'customer@example.com',
   *   customerName: 'John Doe',
   *   currency: 'KWD',
   *   paymentMethod: '1', // KNET
   * });
   *
   * // Redirect user to order.paymentUrl
   * ```
   */
  async createProductOrder(orderData: {
    items: Array<{ productId: string; quantity: number; price: number }>;
    customerId: string;
    customerEmail: string;
    customerName: string;
    currency: string;
    paymentMethod: string;
  }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Calculate total amount
      const totalAmount = orderData.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      // 2. Create order entity (replace with your actual entity)
      // const order = this.orderRepository.create({
      //   totalAmount,
      //   currency: orderData.currency,
      //   status: 'pending',
      //   items: orderData.items,
      //   customerId: orderData.customerId,
      //   customerEmail: orderData.customerEmail,
      //   customerName: orderData.customerName,
      // });
      // const savedOrder = await queryRunner.manager.save(order);

      // For example purposes, using a mock order
      const savedOrder = {
        id: 'order-' + Date.now(),
        totalAmount,
        currency: orderData.currency,
        status: 'pending' as const,
        items: orderData.items,
        customerId: orderData.customerId,
        customerEmail: orderData.customerEmail,
        customerName: orderData.customerName,
        createdAt: new Date(),
      };

      // 3. Create payment using utility function (works with any entity type)
      const paymentResult = await createPaymentForEntity(
        this.paymentService,
        queryRunner.manager.getRepository(Payment),
        {
          entityId: savedOrder.id, // Generic entity ID (orderId, donationId, etc.)
          amount: totalAmount,
          currency: orderData.currency,
          description: `Order #${savedOrder.id} - ${orderData.items.length} item(s)`,
          customerName: orderData.customerName,
          customerEmail: orderData.customerEmail,
          paymentMethodId: orderData.paymentMethod,
          metadata: {
            entityType: 'product_order', // Generic entity type
            itemCount: orderData.items.length,
            customerId: orderData.customerId,
          },
        },
      );

      const savedPayment = paymentResult.payment;

      // 5. Link payment to order
      // await queryRunner.manager.update(ProductOrder, savedOrder.id, {
      //   paymentId: savedPayment.id,
      //   paymentStatus: 'pending',
      // });

      await queryRunner.commitTransaction();

      return {
        order: savedOrder,
        paymentUrl: paymentResult.paymentUrl,
        invoiceId: paymentResult.invoiceId,
        paymentId: paymentResult.paymentId,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle payment webhook for product orders
   *
   * This method should be called from your webhook controller
   * when a payment status changes.
   *
   * @param invoiceId Payment provider invoice ID
   * @returns Updated order status
   */
  async handleProductOrderWebhook(invoiceId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Find payment by transaction ID
      const payment = await this.paymentRepository.findOne({
        where: { transactionId: invoiceId },
      });

      if (!payment) {
        throw new NotFoundException(
          `Payment not found for invoice: ${invoiceId}`,
        );
      }

      // 2. Get latest payment status from provider
      const statusResult =
        await this.paymentService.getPaymentStatus(invoiceId);

      // 3. Update payment status
      payment.status = statusResult.outcome; // 'paid', 'failed', or 'pending'
      await queryRunner.manager.save(payment);

      // 4. Update order status based on payment outcome
      // const order = await this.orderRepository.findOne({
      //   where: { paymentId: payment.id },
      // });

      // if (order) {
      //   if (statusResult.outcome === 'paid') {
      //     order.status = 'paid';
      //     order.paidAt = new Date();
      //   } else if (statusResult.outcome === 'failed') {
      //     order.status = 'failed';
      //   }
      //   await queryRunner.manager.save(order);
      // }

      await queryRunner.commitTransaction();

      return {
        success: true,
        paymentId: payment.id,
        status: statusResult.outcome,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Reconcile payment status manually
   *
   * Useful for checking payment status on-demand or via cron job.
   * Uses the generic reconcilePayment utility function.
   *
   * @param paymentId Payment ID (database UUID) or transaction ID
   * @returns Reconciliation result
   */
  async reconcileProductOrderPayment(paymentId: string) {
    // Use generic reconciliation utility function
    return await reconcilePayment(
      this.paymentService,
      this.paymentRepository,
      paymentId,
      {
        onPaid: async (payment, statusResult) => {
          // Update order status when payment is successful
          // const order = await this.orderRepository.findOne({
          //   where: { paymentId: payment.id },
          // });
          // if (order && order.status !== 'paid') {
          //   order.status = 'paid';
          //   order.paidAt = new Date();
          //   await this.orderRepository.save(order);
          // }
        },
        onFailed: async (payment, statusResult) => {
          // Update order status when payment fails
          // const order = await this.orderRepository.findOne({
          //   where: { paymentId: payment.id },
          // });
          // if (order) {
          //   order.status = 'failed';
          //   await this.orderRepository.save(order);
          // }
        },
      },
    );
  }
}

// ============================================================================
// EXAMPLE 2: COURSE ORDER
// ============================================================================

/**
 * Example: Course Order Entity
 *
 * This represents an order for purchasing/enrolling in courses.
 */
interface CourseOrder {
  id: string;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  paymentId?: string;
  courses: Array<{
    courseId: string;
    courseName: string;
    price: number;
  }>;
  studentId: string;
  studentEmail: string;
  studentName: string;
  enrolledAt?: Date;
  createdAt: Date;
}

/**
 * Example: Course Order Service
 *
 * This service demonstrates how to integrate payment with course orders.
 */
@Injectable()
export class CourseOrderPaymentExample {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a course order with payment
   *
   * @param orderData Course order data
   * @returns Order with payment URL
   *
   * @example
   * ```typescript
   * const order = await courseOrderService.createCourseOrder({
   *   courses: [
   *     { courseId: 'course-123', courseName: 'React Mastery', price: 100 },
   *     { courseId: 'course-456', courseName: 'Node.js Advanced', price: 150 },
   *   ],
   *   studentId: 'user-123',
   *   studentEmail: 'student@example.com',
   *   studentName: 'Jane Doe',
   *   currency: 'KWD',
   *   paymentMethod: '2', // VISA/MASTER
   * });
   * ```
   */
  async createCourseOrder(orderData: {
    courses: Array<{ courseId: string; courseName: string; price: number }>;
    studentId: string;
    studentEmail: string;
    studentName: string;
    currency: string;
    paymentMethod: string;
  }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Calculate total amount
      const totalAmount = orderData.courses.reduce(
        (sum, course) => sum + course.price,
        0,
      );

      // 2. Create course order entity
      const savedOrder: CourseOrder = {
        id: 'course-order-' + Date.now(),
        totalAmount,
        currency: orderData.currency,
        status: 'pending',
        courses: orderData.courses,
        studentId: orderData.studentId,
        studentEmail: orderData.studentEmail,
        studentName: orderData.studentName,
        createdAt: new Date(),
      };

      // 3. Create payment using utility function (works with any entity type)
      const courseNames = orderData.courses.map((c) => c.courseName).join(', ');
      const paymentResult = await createPaymentForEntity(
        this.paymentService,
        queryRunner.manager.getRepository(Payment),
        {
          entityId: savedOrder.id, // Generic entity ID
          amount: totalAmount,
          currency: orderData.currency,
          description: `Course Enrollment: ${courseNames}`,
          customerName: orderData.studentName,
          customerEmail: orderData.studentEmail,
          paymentMethodId: orderData.paymentMethod,
          metadata: {
            entityType: 'course_order', // Generic entity type
            courseCount: orderData.courses.length,
            courseIds: orderData.courses.map((c) => c.courseId),
            studentId: orderData.studentId,
          },
        },
      );

      //   const savedPayment = paymentResult.payment;

      // 5. Link payment to order (update your order entity)
      // savedOrder.paymentId = savedPayment.id;
      // await queryRunner.manager.save(savedOrder);

      await queryRunner.commitTransaction();

      return {
        order: savedOrder,
        paymentUrl: paymentResult.paymentUrl,
        invoiceId: paymentResult.invoiceId,
        paymentId: paymentResult.paymentId,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle payment webhook for course orders
   *
   * When payment is successful, enroll student in courses.
   */
  async handleCourseOrderWebhook(invoiceId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Find payment
      const payment = await this.paymentRepository.findOne({
        where: { transactionId: invoiceId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment not found: ${invoiceId}`);
      }

      // 2. Get latest status
      const statusResult =
        await this.paymentService.getPaymentStatus(invoiceId);

      // 3. Update payment
      payment.status = statusResult.outcome;
      await queryRunner.manager.save(payment);

      // 4. If paid, enroll student in courses
      if (statusResult.outcome === 'paid') {
        // Find order
        // const order = await this.courseOrderRepository.findOne({
        //   where: { paymentId: payment.id },
        // });
        // if (order && order.status !== 'paid') {
        //   // Enroll student in all courses
        //   for (const course of order.courses) {
        //     await this.enrollStudentInCourse(order.studentId, course.courseId);
        //   }
        //   order.status = 'paid';
        //   order.enrolledAt = new Date();
        //   await queryRunner.manager.save(order);
        // }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        paymentId: payment.id,
        status: statusResult.outcome,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

// ============================================================================
// EXAMPLE 3: SUBSCRIPTION ORDER
// ============================================================================

/**
 * Example: Subscription Order
 *
 * This represents a subscription payment (monthly, yearly, etc.).
 */
interface SubscriptionOrder {
  id: string;
  planId: string;
  planName: string;
  monthlyAmount: number;
  currency: string;
  status: 'pending' | 'active' | 'failed' | 'cancelled';
  paymentId?: string;
  userId: string;
  startDate?: Date;
  nextBillingDate?: Date;
  createdAt: Date;
}

/**
 * Example: Subscription Service
 *
 * This service demonstrates how to integrate payment with subscriptions.
 */
@Injectable()
export class SubscriptionOrderPaymentExample {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a subscription with initial payment
   *
   * @param subscriptionData Subscription data
   * @returns Subscription with payment URL
   */
  async createSubscription(subscriptionData: {
    planId: string;
    planName: string;
    monthlyAmount: number;
    currency: string;
    userId: string;
    userEmail: string;
    userName: string;
    paymentMethod: string;
  }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create subscription entity
      const subscription: SubscriptionOrder = {
        id: 'sub-' + Date.now(),
        planId: subscriptionData.planId,
        planName: subscriptionData.planName,
        monthlyAmount: subscriptionData.monthlyAmount,
        currency: subscriptionData.currency,
        status: 'pending',
        userId: subscriptionData.userId,
        createdAt: new Date(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      };

      // 2. Create payment for first month using utility function
      const paymentResult = await createPaymentForEntity(
        this.paymentService,
        queryRunner.manager.getRepository(Payment),
        {
          entityId: subscription.id, // Generic entity ID
          amount: subscriptionData.monthlyAmount,
          currency: subscriptionData.currency,
          description: `Subscription: ${subscriptionData.planName} (First Month)`,
          customerName: subscriptionData.userName,
          customerEmail: subscriptionData.userEmail,
          paymentMethodId: subscriptionData.paymentMethod,
          metadata: {
            entityType: 'subscription', // Generic entity type
            planId: subscriptionData.planId,
            userId: subscriptionData.userId,
            billingCycle: 'monthly',
          },
        },
      );

      //   const savedPayment = paymentResult.payment;

      // 4. Link payment to subscription
      // subscription.paymentId = savedPayment.id;
      // await queryRunner.manager.save(subscription);

      await queryRunner.commitTransaction();

      return {
        subscription,
        paymentUrl: paymentResult.paymentUrl,
        invoiceId: paymentResult.invoiceId,
        paymentId: paymentResult.paymentId,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle subscription payment webhook
   *
   * Activates subscription when payment is successful.
   */
  async handleSubscriptionWebhook(invoiceId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = await this.paymentRepository.findOne({
        where: { transactionId: invoiceId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment not found: ${invoiceId}`);
      }

      const statusResult =
        await this.paymentService.getPaymentStatus(invoiceId);

      payment.status = statusResult.outcome;
      await queryRunner.manager.save(payment);

      if (statusResult.outcome === 'paid') {
        // Find subscription
        // const subscription = await this.subscriptionRepository.findOne({
        //   where: { paymentId: payment.id },
        // });
        // if (subscription && subscription.status !== 'active') {
        //   subscription.status = 'active';
        //   subscription.startDate = new Date();
        //   subscription.nextBillingDate = new Date(
        //     Date.now() + 30 * 24 * 60 * 60 * 1000,
        //   );
        //   await queryRunner.manager.save(subscription);
        // }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        paymentId: payment.id,
        status: statusResult.outcome,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

// ============================================================================
// NOTES ON USING UTILITY FUNCTIONS
// ============================================================================

/**
 * IMPORTANT: This file now uses utility functions from payment.utils.ts
 *
 * All payment operations (create, webhook, reconcile) now use generic
 * utility functions that work with any entity type:
 *
 * - createPaymentForEntity: Creates payment for any entity (order, donation, subscription, etc.)
 * - handlePaymentWebhook: Handles webhooks for any entity type
 * - reconcilePayment: Reconciles payment status for any entity type
 *
 * These functions are:
 * - Provider-agnostic: Work with MyFatoorah, Stripe, PayMob, etc.
 * - Entity-agnostic: Work with orders, donations, subscriptions, courses, etc.
 * - Reusable: Can be used across different projects
 * - Type-safe: Full TypeScript support
 *
 * ## Example Usage
 *
 * ```typescript
 * import {
 *   createPaymentForEntity,
 *   handlePaymentWebhook,
 *   reconcilePayment,
 * } from '../utils/payment.utils';
 *
 * // Create payment for any entity
 * const result = await createPaymentForEntity(
 *   paymentService,
 *   paymentRepository,
 *   {
 *     entityId: 'order-123', // or 'donation-123', 'subscription-123', etc.
 *     amount: 100,
 *     currency: 'KWD',
 *     description: 'Payment description',
 *     customerName: 'John Doe',
 *     customerEmail: 'john@example.com',
 *     paymentMethodId: '1',
 *     metadata: { entityType: 'order' }, // or 'donation', 'subscription', etc.
 *   }
 * );
 *
 * // Handle webhook
 * await handlePaymentWebhook(
 *   paymentService,
 *   paymentRepository,
 *   invoiceId,
 *   {
 *     onPaid: async (payment, statusResult) => {
 *       // Update entity status
 *       await orderRepository.update(
 *         { paymentId: payment.id },
 *         { status: 'paid' }
 *       );
 *     },
 *   }
 * );
 *
 * // Reconcile payment
 * await reconcilePayment(
 *   paymentService,
 *   paymentRepository,
 *   paymentId,
 *   {
 *     onPaid: async (payment, statusResult) => {
 *       // Handle successful payment
 *     },
 *   }
 * );
 * ```
 *
 * See payment.utils.ts for complete documentation and more examples.
 */
