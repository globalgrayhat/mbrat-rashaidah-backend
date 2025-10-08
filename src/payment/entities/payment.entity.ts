import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  // OneToOne,
  // JoinColumn,
  OneToMany,
} from 'typeorm';
import { Donation } from '../../donations/entities/donation.entity';
import { PaymentMethodEnum } from '../../common/constants/payment.constant';

/**
 * Represents a payment transaction in the system.
 */
@Entity('payments')
export class Payment {
  /**
   * The unique identifier for the payment (UUID).
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The amount of the payment.
   */
  @Column('decimal', { precision: 10, scale: 0 })
  amount: number;

  /**
   * The currency code for the payment (e.g., 'KWD').
   */
  @Column({ length: 3 })
  currency: string;

  /**
   * The method used for the payment (e.g., KNET, VISA).
   */
  @Column({
    type: 'enum',
    enum: PaymentMethodEnum,
  })
  paymentMethod: PaymentMethodEnum;

  /**
   * The unique transaction ID from the payment gateway.
   * The `unique: true` option is sufficient to create a unique index and enforce uniqueness.
   */
  @Column({ length: 255, unique: true })
  transactionId: string;

  /**
   * The URL provided by the payment gateway for the user to complete the payment.
   */
  @Column({ length: 500, nullable: true })
  paymentUrl?: string;

  /**
   * The status of the payment (e.g., 'Success', 'Failed', 'Pending').
   * It's a good practice to use an enum here for better type safety.
   */
  @Column({ length: 50 })
  status: string;

  /**
   * Stores the raw JSON response from the payment gateway for debugging and logging purposes.
   */
  @Column('json', { nullable: true })
  rawResponse?: any;

  /**
   * A one-to-one relationship with the Donation entity.
   * TypeORM will automatically create a `donationId` foreign key column in the database based on this relationship.
   */
  @OneToMany(() => Donation, (d) => d.payment)
  donations: Donation[];

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
