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

/**
 * يمثل سجل معاملة دفع مع معالج الدفع الخارجي.
 * هذا الكيان يتتبع تفاصيل الدفع بغض النظر عن حالة التبرع.
 */
@Entity('payments')
export class Payment {
  /**
   * المفتاح الأساسي: UUID يتم إنشاؤه تلقائيًا
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * المبلغ المتوقع للدفع
   */
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  /**
   * رمز العملة (مثل KWD، USD)
   */
  @Column({ length: 3 })
  currency: string;

  /**
   * طريقة الدفع المستخدمة (مثل Stripe، MyFatoorah، KNET)
   */
  @Column({
    type: 'enum',
    enum: PaymentMethodEnum,
  })
  paymentMethod: PaymentMethodEnum;

  /**
   * معرف المعاملة الخارجي من بوابة الدفع (مثل Checkout Session ID من Stripe، Invoice ID من MyFatoorah).
   * هذا المعرف يجب أن يكون فريدًا لضمان عدم تكرار معالجة الـ webhooks.
   */
  @Column({ length: 255, unique: true })
  @Index({ unique: true }) // إضافة فهرس لضمان التفرد وسرعة البحث
  transactionId: string;

  /**
   * رابط الدفع الذي تم إنشاؤه بواسطة بوابة الدفع (إذا كان موجودًا)
   */
  @Column({ length: 500, nullable: true })
  paymentUrl?: string;

  /**
   * الحالة الأولية للدفع من جانب بوابة الدفع (مثل 'pending', 'succeeded', 'failed')
   */
  @Column({ length: 50 })
  status: string; // يمكن أن تكون هذه الحالة أكثر عمومية أو مطابقة لحالات بوابة الدفع

  /**
   * تفاصيل الدفع الإضافية المخزنة كـ JSON (الاستجابة الخام من بوابة الدفع)
   */
  @Column('json', { nullable: true })
  rawResponse?: any;

  /**
   * كائن التبرع المرتبط بهذا الدفع.
   * يمكن لدفع واحد أن يرتبط بتبرع واحد فقط.
   */
  @OneToOne(() => Donation, (donation) => donation.payment, {
    nullable: true, // يمكن أن يوجد سجل دفع قبل إنشاء سجل التبرع الكامل أو في حالة فشله
    onDelete: 'SET NULL', // إذا تم حذف التبرع، قم بتعيين معرف التبرع إلى NULL هنا
  })
  @JoinColumn({ name: 'donationId' })
  donation: Donation;

  /**
   * المفتاح الأجنبي للتبرع المرتبط
   */
  @Column('uuid', { nullable: true, unique: true }) // معرف التبرع يجب أن يكون فريدًا
  donationId?: string;

  /**
   * الطابع الزمني عند إنشاء سجل الدفع
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * الطابع الزمني عند آخر تحديث لسجل الدفع
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
