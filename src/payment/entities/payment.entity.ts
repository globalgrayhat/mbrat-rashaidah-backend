import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Donation } from '../../donations/entities/donation.entity';
import { PaymentMethodEnum } from '../../common/constants/payment.constant';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3 })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodEnum,
  })
  InvoicePaymentMethods: PaymentMethodEnum;

  @Column({ length: 255, unique: true })
  @Index({ unique: true }) // إضافة فهرس لضمان التفرد وسرعة البحث
  transactionId: string;

  @Column({ length: 500, nullable: true })
  paymentUrl?: string;

  @Column({ length: 50 })
  status: string; // يمكن أن تكون هذه الحالة أكثر عمومية أو مطابقة لحالات بوابة الدفع

  @Column('json', { nullable: true })
  rawResponse?: any;

  @OneToOne(() => Donation, (donation) => donation.payment, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'donationId' })
  donation: Donation;

  @Column('uuid', { nullable: true, unique: true }) // معرف التبرع يجب أن يكون فريدًا
  donationId?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
