import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OutboxStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
  RESOLVED_MANUALLY = 'resolved_manually',
}

@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  eventType: string; // e.g., 'DONATION_PAYMENT_INIT'

  @Column('json')
  payload: {
    donationIds: string[];
    totalAmount: number;
    currency: string;
    paymentMethod: string;
    donorId?: string;
    correlationId?: string;
    [key: string]: any;
  };

  @Column({
    type: 'enum',
    enum: OutboxStatus,
    default: OutboxStatus.PENDING,
  })
  @Index()
  status: OutboxStatus;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ default: 0 })
  retryCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  @Index()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ nullable: true })
  transactionId?: string; // Gateway transaction ID if available
}
