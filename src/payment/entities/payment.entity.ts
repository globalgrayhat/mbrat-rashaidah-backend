/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  // OneToMany,
  Index,
} from 'typeorm';
// External dependency - remove when migrating to another project
// This import is only used for the OneToMany relationship with Donation
// When migrating, you can:
// 1. Remove this import and the donations relationship
// 2. Use referenceType and referenceId instead (more flexible)
// See MIGRATION_IMPORTS_FIX.md for instructions
// import { Donation } from '../../donations/entities/donation.entity';

/**
 * Represents a payment transaction in the system.
 */
@Entity('payments')
@Index(['status'])
@Index(['paymentMethod'])
@Index(['currency'])
@Index(['createdAt'])
export class Payment {
  /**
   * The unique identifier for the payment (UUID).
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The amount of the payment.
   * Using precision 15 and scale 3 to support KWD and other currencies with up to 3 decimal places.
   */
  @Column('decimal', { precision: 15, scale: 3 })
  amount: number;

  /**
   * The currency code for the payment (e.g., 'KWD').
   */
  @Column({ length: 3 })
  currency: string;

  /**
   * The method used for the payment (e.g., KNET, VISA).
   * Stored as string to support any payment method ID from providers
   * (MyFatoorah, Stripe, PayMob, etc.) without being restricted to a fixed enum.
   * This makes the system flexible and provider-agnostic.
   */
  @Column({ type: 'varchar', length: 50 })
  paymentMethod: string;

  /**
   * The unique transaction ID from the payment gateway.
   * The `unique: true` option is sufficient to create a unique index and enforce uniqueness.
   */
  @Column({ length: 255, unique: true })
  transactionId: string;

  /**
   * The URL provided by the payment gateway for the user to complete the payment.
   */
  @Column({ type: 'text', nullable: true })
  paymentUrl?: string;

  /**
   * The status of the payment (e.g., 'Success', 'Failed', 'Pending').
   * It's a good practice to use an enum here for better type safety.
   */
  @Column({ length: 50 })
  status: string;
  
  /**
   * The specific payment ID from MyFatoorah (needed for backward compatibility/reconciliation).
   */
  @Column({ length: 255, nullable: true })
  mfPaymentId?: string;


  /**
   * Stores the raw JSON response from the payment gateway for debugging and logging purposes.
   */
  @Column('json', { nullable: true })
  rawResponse?: any;

  /**
   * Relationship with Donation entity (project-specific).
   * 
   * When migrating to another project:
   * 1. Remove this relationship if you don't have Donation entity
   * 2. Use referenceType and referenceId instead for flexible linking
   * 
   * Example without relationship:
   * ```typescript
   * // Query payments for a specific entity type
   * const payments = await paymentRepository.find({
   *   where: { referenceType: 'order', referenceId: orderId }
   * });
   * ```
   */
  // @OneToMany(() => Donation, (d) => d.payment)
  // donations: Donation[];

  /**
   * Timestamp automatically set when the payment record is first created.
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp automatically set when the payment record is last updated.
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
