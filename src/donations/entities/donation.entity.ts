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
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Donor } from '../../donor/entities/donor.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { DonationStatusEnum } from '../../common/constants/donationStatus.constant';
import { PaymentMethodEnum } from '../../common/constants/payment.constant';

@Entity('donations')
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 10, scale: 3 })
  amount: number;

  @Column({ length: 3 })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodEnum,
  })
  paymentMethod: PaymentMethodEnum;

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
