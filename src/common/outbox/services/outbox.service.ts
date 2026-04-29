import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { OutboxEvent, OutboxStatus } from '../entities/outbox-event.entity';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
  ) {}

  /**
   * Creates a new outbox event within a transaction
   */
  async createEvent(
    eventType: string,
    payload: any,
    em?: EntityManager,
  ): Promise<OutboxEvent> {
    const repo = em ? em.getRepository(OutboxEvent) : this.outboxRepository;
    const event = repo.create({
      eventType,
      payload,
      status: OutboxStatus.PENDING,
    });
    return repo.save(event);
  }

  /**
   * Marks an outbox event as processed
   */
  async markAsProcessed(
    id: string,
    transactionId?: string,
    em?: EntityManager,
  ): Promise<void> {
    const repo = em ? em.getRepository(OutboxEvent) : this.outboxRepository;
    await repo.update(id, {
      status: OutboxStatus.PROCESSED,
      processedAt: new Date(),
      transactionId,
    });
  }

  /**
   * Marks an outbox event as failed with an error message
   */
  async markAsFailed(
    id: string,
    error: string,
    em?: EntityManager,
  ): Promise<void> {
    const repo = em ? em.getRepository(OutboxEvent) : this.outboxRepository;
    await repo.update(id, {
      status: OutboxStatus.FAILED,
      error,
    });
  }

  /**
   * Finds pending events that have not been processed within a certain time frame
   */
  async findStuckEvents(olderThanMinutes: number = 5): Promise<OutboxEvent[]> {
    const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    return this.outboxRepository
      .createQueryBuilder('event')
      .where('event.status = :status', { status: OutboxStatus.PENDING })
      .andWhere('event.createdAt < :threshold', { threshold })
      .andWhere('event.retryCount < :maxRetries', { maxRetries: 5 })
      .getMany();
  }

  /**
   * Increments the retry count for an event
   */
  async incrementRetry(id: string, error: string): Promise<void> {
    await this.outboxRepository
      .createQueryBuilder()
      .update(OutboxEvent)
      .set({
        retryCount: () => 'retryCount + 1',
        error,
      })
      .where('id = :id', { id })
      .execute();
  }
}
