import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Project } from '../../projects/entities/project.entity';
import { User } from '../../user/entities/user.entity';
import { DonationStatusEnum } from '../../common/constants/donationStatus.constant';
import { PaymentMethodEnum } from '../../common/constants/payment.constant';

/**
 * Represents a donation record made by a user towards a project
 */
@Entity('donations')
export class Donation {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Amount donated
   */
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  /**
   * Currency code for the donation (e.g., USD, EUR)
   */
  @Column({ length: 3 })
  currency: string;

  /**
   * Payment method used for the donation
   */
  @Column({
    type: 'enum',
    enum: PaymentMethodEnum,
  })
  paymentMethod: PaymentMethodEnum;

  /**
   * Current status of the donation
   */
  @Column({
    type: 'enum',
    enum: DonationStatusEnum,
    default: DonationStatusEnum.PENDING,
  })
  status: DonationStatusEnum;

  /**
   * External payment gateway transaction ID
   */
  @Column({ length: 255, nullable: true })
  paymentId?: string;

  /**
   * Additional payment details stored as JSON
   */
  @Column('json', { nullable: true })
  paymentDetails?: any;

  /**
   * Timestamp when payment was completed
   */
  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  /**
   * Associated project for this donation
   */
  @ManyToOne(() => Project, { eager: true })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  /**
   * Foreign key for project
   */
  @Column('uuid')
  projectId: string;

  /**
   * Donor who made the donation (optional)
   */
  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'donorId' })
  donor?: User;

  /**
   * Foreign key for donor user
   */
  @Column('uuid', { nullable: true })
  donorId?: string;

  /**
   * Timestamp when the donation record was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the donation record was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
