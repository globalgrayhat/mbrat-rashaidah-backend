import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { OutboxEvent, OutboxStatus } from '../entities/outbox-event.entity';

export interface DonationPaymentInitPayload {
  donationIds: string[];
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  donorId?: string;
  correlationId?: string;
  providerInvoiceId?: string;
  transactionId?: string;
  providerPaymentId?: string;
  paymentUrl?: string;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly MAX_RETRIES = 5;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
  ) {}

  /**
   * Creates a new outbox event within a transaction
   */
  async createEvent(
    eventType: string,
    payload: DonationPaymentInitPayload | any,
    em?: EntityManager,
  ): Promise<OutboxEvent> {
    // Basic validation for critical event type
    if (eventType === 'DONATION_PAYMENT_INIT') {
      const p = payload as DonationPaymentInitPayload;
      if (!p.donationIds || p.donationIds.length === 0) {
        throw new InternalServerErrorException('donationIds is required for DONATION_PAYMENT_INIT');
      }
      if (typeof p.totalAmount !== 'number') {
        throw new InternalServerErrorException('totalAmount must be a number');
      }
    }

    const repo = em ? em.getRepository(OutboxEvent) : this.outboxRepository;
    const event = repo.create({
      eventType,
      payload,
      status: OutboxStatus.PENDING,
      retryCount: 0,
    });
    return repo.save(event);
  }

  /**
   * Atomically claims an event for processing by moving it from PENDING to PROCESSING
   */
  async claimEvent(id: string): Promise<boolean> {
    const result = await this.outboxRepository.update(
      { id, status: OutboxStatus.PENDING },
      { status: OutboxStatus.PROCESSING },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Moves a claimed event back to PENDING if a temporary error occurs
   */
  async releaseToPending(id: string): Promise<void> {
    await this.outboxRepository.update(
      { id, status: OutboxStatus.PROCESSING },
      { status: OutboxStatus.PENDING },
    );
  }

  /**
   * Updates the outbox payload with provider references as soon as they are received
   */
  async attachProviderReference(
    id: string,
    transactionId: string,
    providerPaymentId?: string,
    paymentUrl?: string,
    em?: EntityManager,
  ): Promise<void> {
    const repo = em ? em.getRepository(OutboxEvent) : this.outboxRepository;
    const event = await repo.findOne({ where: { id } });
    if (!event) return;

    const payload = {
      ...event.payload,
      providerInvoiceId: transactionId,
      transactionId: transactionId,
      providerPaymentId,
      paymentUrl,
    };

    await repo.update(id, {
      transactionId,
      payload: payload as any,
    });
  }

  /**
   * Marks an outbox event as processed (idempotent)
   */
  async markAsProcessed(
    id: string,
    transactionId?: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const repo = em ? em.getRepository(OutboxEvent) : this.outboxRepository;
    const result = await repo.update(
      { 
        id, 
        status: In([OutboxStatus.PENDING, OutboxStatus.PROCESSING]) 
      },
      {
        status: OutboxStatus.PROCESSED,
        processedAt: new Date(),
        transactionId,
        error: undefined,
      } as any,
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Marks an outbox event as failed
   */
  async markAsFailed(
    id: string,
    error: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const repo = em ? em.getRepository(OutboxEvent) : this.outboxRepository;
    const result = await repo.update(
      { id, status: In([OutboxStatus.PENDING, OutboxStatus.PROCESSING]) },
      {
        status: OutboxStatus.FAILED,
        error,
        processedAt: new Date(),
      },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Marks an outbox event for manual review
   */
  async markAsManualReview(
    id: string,
    reason: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const repo = em ? em.getRepository(OutboxEvent) : this.outboxRepository;
    const result = await repo.update(
      { id, status: In([OutboxStatus.PENDING, OutboxStatus.PROCESSING]) },
      {
        status: OutboxStatus.MANUAL_REVIEW,
        error: reason,
      },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Finds pending events that have not been processed within a certain time frame
   */
  async findStuckEvents(olderThanMinutes: number = 5, limit: number = 50): Promise<OutboxEvent[]> {
    const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    return this.outboxRepository
      .createQueryBuilder('event')
      .where('event.status = :status', { status: OutboxStatus.PENDING })
      .andWhere('event.createdAt < :threshold', { threshold })
      .andWhere('event.retryCount < :maxRetries', { maxRetries: this.MAX_RETRIES })
      .orderBy('event.createdAt', 'ASC')
      .limit(limit)
      .getMany();
  }

  /**
   * Increments the retry count for an event and potentially moves it to FAILED state
   */
  async incrementRetry(id: string, error: string): Promise<void> {
    const event = await this.outboxRepository.findOne({ where: { id } });
    if (!event) return;

    const newRetryCount = event.retryCount + 1;
    const shouldFail = newRetryCount >= this.MAX_RETRIES;

    await this.outboxRepository.update(id, {
      retryCount: newRetryCount,
      error,
      status: shouldFail ? OutboxStatus.FAILED : OutboxStatus.PENDING,
      processedAt: shouldFail ? new Date() : undefined,
    });
  }
}
