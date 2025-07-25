import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';

import { Project } from '../../projects/entities/project.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity'; // Import Campaign
import { Donor } from '../../donor/entities/donor.entity'; // Import Donor
import { DonationStatusEnum } from '../../common/constants/donationStatus.constant';
import { PaymentMethodEnum } from '../../common/constants/payment.constant';
import { Payment } from '../../payment/entities/payment.entity';
/**
 * Represents a donation record made by a donor towards a project or campaign
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
   * Associated project for this donation (nullable)
   */
  @ManyToOne(() => Project, (project) => project.donations, { nullable: true })
  @JoinColumn({ name: 'projectId' })
  project?: Project;

  /**
   * Foreign key for project (nullable)
   */
  @Column('uuid', { nullable: true })
  projectId?: string;

  /**
   * Associated campaign for this donation (nullable)
   */
  @ManyToOne(() => Campaign, (campaign) => campaign.donations, {
    nullable: true,
  })
  @JoinColumn({ name: 'campaignId' })
  campaign?: Campaign;

  /**
   * Foreign key for campaign (nullable)
   */
  @Column('uuid', { nullable: true })
  campaignId?: string;

  /**
   * Donor who made the donation (optional)
   */
  @ManyToOne(() => Donor, (donor) => donor.donations, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'donorId' })
  donor?: Donor;

  /**
   /**
    * Payment associated with this donation (optional)
    */
  @OneToOne(() => Payment, (payment) => payment.donation, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'paymentId' })
  payment?: Payment;

  /**
   * Foreign key for donor user (optional, can be null for anonymous)
   */
  @Column('uuid', { nullable: true })
  donorId?: string;

  /**
   * Email of the anonymous donor (if provided and donor is anonymous)
   */
  @Column({ nullable: true })
  anonymousEmail?: string;

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
