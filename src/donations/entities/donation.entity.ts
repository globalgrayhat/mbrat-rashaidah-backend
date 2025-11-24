import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Donor } from '../../donor/entities/donor.entity';
import { Payment } from '../../payment/common/entities/payment.entity';
import { DonationStatusEnum } from '../../common/constants/donationStatus.constant';

@Entity('donations')
@Index(['paymentId'])
@Index(['projectId'])
@Index(['campaignId'])
@Index(['donorId'])
@Index(['status'])
@Index(['createdAt'])
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The donation amount.
   * Using precision 15 and scale 3 to support KWD and other currencies with up to 3 decimal places.
   */
  @Column('decimal', { precision: 15, scale: 3 })
  amount: number;

  @Column({ length: 3 })
  currency: string;

  /**
   * The payment method used for the donation.
   * Stored as string to support any payment method ID from providers
   * (MyFatoorah, Stripe, PayMob, etc.) without being restricted to a fixed enum.
   * This makes the system flexible and provider-agnostic.
   */
  @Column({ type: 'varchar', length: 50 })
  paymentMethod: string;

  @Column({
    type: 'enum',
    enum: DonationStatusEnum,
    default: DonationStatusEnum.PENDING,
  })
  status: DonationStatusEnum;

  @Column('json', {
    nullable: true,
    comment: 'Raw response from payment gateway on creation',
  })
  paymentDetails?: any;

  @Column('json', {
    nullable: true,
    comment: 'Raw response from payment gateway webhook',
  })
  webhookResponse?: any;
  // --- End Payment Gateway Details ---

  @ManyToOne(() => Payment, (p) => p.donations, { nullable: true })
  @JoinColumn({ name: 'paymentId' })
  payment?: Payment;

  @Column({ type: 'char', length: 36, nullable: true })
  paymentId?: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  @ManyToOne(() => Project, (project) => project.donations, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'projectId' })
  project?: Project;

  @Column('uuid', { nullable: true })
  projectId?: string;

  @ManyToOne(() => Campaign, (campaign) => campaign.donations, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'campaignId' })
  campaign?: Campaign;

  @Column('uuid', { nullable: true })
  campaignId?: string;

  @ManyToOne(() => Donor, (donor) => donor.donations, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'donorId' })
  donor?: Donor;

  @Column('uuid', { nullable: true })
  donorId?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
