// [FIXED 2025-06-04]
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

export enum DonationStatusEnum {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SUCCESSFUL = 'SUCCESSFUL',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethodEnum {
  STRIPE = 'stripe',
  MYFATOORA = 'myfatoora',
}

@Entity('donations')
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column()
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

  @Column({ nullable: true })
  paymentId: string;

  @Column('jsonb', { nullable: true })
  paymentDetails: any;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'donorId' })
  donor: User;

  @Column({ nullable: true })
  donorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
