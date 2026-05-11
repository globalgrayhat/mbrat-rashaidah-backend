/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotAcceptableException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  Optional,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';

import { Donation } from './entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Donor } from '../donor/entities/donor.entity';
import { User } from '../user/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';

import {
  MyFatooraWebhookEvent,
  PaymentResult,
} from '../payment/common/interfaces/payment-service.interface';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
// PaymentMethodEnum is no longer used - payment methods are provider-specific
// and stored as strings/numbers to support any provider's payment method IDs
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../common/services/notification.service';
import { PaymentReconciliationService } from '../payment/common/cron/payment-reconciliation.cron';
import { OutboxService } from '../common/outbox/services/outbox.service';
import {
  OutboxEvent,
  OutboxStatus,
} from '../common/outbox/entities/outbox-event.entity';
import {
  createPaymentForEntity,
  createLocalPaymentForEntityFromResult,
  CreatePaymentResult,
} from '../payment/common/utils/payment.utils';
import {
  deriveOutcome,
  normalizeTxStatus,
} from '../payment/common/utils/mf-status.util';

import { DonorsService } from '../donor/donor.service';
import { v4 as uuidv4 } from 'uuid';
import { PaginationService } from '../common/pagination/pagination.service';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { CollectionResponseDto } from '../common/pagination/dto/collection-response.dto';

type MfOutcome = 'paid' | 'failed' | 'pending';

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Donation)
    private readonly donationRepository: Repository<Donation>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Donor)
    private readonly donorRepository: Repository<Donor>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly paymentService: PaymentService,
    private readonly notificationService: NotificationService,
    private readonly donorsService: DonorsService,
    @Optional()
    @Inject(forwardRef(() => PaymentReconciliationService))
    private readonly reconciliationService: PaymentReconciliationService,
    private readonly outboxService: OutboxService,
    private readonly paginationService: PaginationService,
  ) {}

  /**
   * Check if a payment method is supported.
   * Since payment methods are provider-specific and can change,
   * we accept any payment method ID from the provider.
   * This method always returns true to allow flexibility.
   */
  private isSupportedPaymentMethod(m: number | string): boolean {
    // Accept any payment method ID - providers handle validation
    return true;
  }

  /**
   * Get provider-specific configuration error message
   * @param providerName Provider name (myfatoorah, stripe, paymob)
   * @returns Configuration error message
   */
  private getProviderConfigMessage(providerName: string): string {
    const configs: Record<string, string[]> = {
      myfatoorah: [
        'Please ensure the following environment variables are set correctly:',
        '- MYFATOORAH_API_KEY: Your MyFatoorah API key',
        '- MYFATOORAH_API_URL: MyFatoorah API URL (e.g., https://apitest.myfatoorah.com)',
        '- MYFATOORAH_CALLBACK_URL: Callback URL for successful payments',
        '- MYFATOORAH_ERROR_URL: Error URL for failed payments',
        '',
        'For testing, you can use MyFatoorah test credentials.',
      ],
    };

    const config = configs[providerName] || [
      `Please configure ${providerName} API credentials in environment variables.`,
    ];

    return [...config, 'Contact system administrator for assistance.'].join(
      '\n',
    );
  }
  private calcTotalAmount(ds: Donation[]) {
    return ds.reduce((a, d) => a + Number(d.amount), 0);
  }

  private async validateItems(
    donationItems: CreateDonationDto['donationItems'],
  ) {
    if (!donationItems?.length)
      throw new BadRequestException('Donation items required');

    const projectIds = donationItems
      .map((i) => i?.projectId)
      .filter((x): x is string => Boolean(x));
    const campaignIds = donationItems
      .map((i) => i?.campaignId)
      .filter((x): x is string => Boolean(x));

    const [projects, campaigns] = await Promise.all([
      projectIds.length
        ? this.projectRepository.find({ where: { id: In(projectIds) } })
        : Promise.resolve<Project[]>([]),
      campaignIds.length
        ? this.campaignRepository.find({ where: { id: In(campaignIds) } })
        : Promise.resolve<Campaign[]>([]),
    ]);

    const projectMap = new Map<string, Project>(
      projects.map((p): [string, Project] => [p.id, p]),
    );
    const campaignMap = new Map<string, Campaign>(
      campaigns.map((c): [string, Campaign] => [c.id, c]),
    );

    return donationItems.map((item) => {
      if (item.projectId) {
        const project = projectMap.get(item.projectId);
        if (!project)
          throw new NotFoundException(`Project ${item.projectId} not found`);
        if (!project.isDonationActive)
          throw new NotAcceptableException(
            `Donations not active for project ${item.projectId}`,
          );
        return {
          amount: item.amount,
          projectId: item.projectId,
          targetEntity: project,
          targetType: 'project' as const,
        };
      }
      if (item.campaignId) {
        const campaign = campaignMap.get(item.campaignId);
        if (!campaign)
          throw new NotFoundException(`Campaign ${item.campaignId} not found`);
        if (!campaign.isDonationActive)
          throw new NotAcceptableException(
            `Donations not active for campaign ${item.campaignId}`,
          );
        return {
          amount: item.amount,
          campaignId: item.campaignId,
          targetEntity: campaign,
          targetType: 'campaign' as const,
        };
      }
      throw new BadRequestException(
        'Each donation item must reference a project or campaign.',
      );
    });
  }
  private normalizeItems(
    validated: Awaited<ReturnType<typeof this.validateItems>>,
  ): {
    amount: number;
    projectId?: string;
    campaignId?: string;
    targetEntity: Project | Campaign;
    targetType: 'project' | 'campaign';
  }[] {
    const map = new Map<
      string,
      {
        amount: number;
        projectId?: string;
        campaignId?: string;
        targetEntity: Project | Campaign;
        targetType: 'project' | 'campaign';
      }
    >();

    for (const it of validated) {
      const key =
        it.targetType === 'project'
          ? `p:${it.targetEntity.id}`
          : `c:${it.targetEntity.id}`;
      const prev = map.get(key);
      if (prev) {
        prev.amount += Number(it.amount);
      } else {
        map.set(key, {
          amount: Number(it.amount),
          projectId:
            it.targetType === 'project' ? it.targetEntity.id : undefined,
          campaignId:
            it.targetType === 'campaign' ? it.targetEntity.id : undefined,
          targetEntity: it.targetEntity,
          targetType: it.targetType,
        });
      }
    }

    return [...map.values()];
  }

  private async createDonations(
    items: {
      amount: number;
      projectId?: string;
      campaignId?: string;
      targetEntity: Project | Campaign;
      targetType: 'project' | 'campaign';
    }[],
    donor: Donor | null,
    currency: string,
    paymentMethod: string,
    em: EntityManager,
  ): Promise<Donation[]> {
    const entities = items.map((it) =>
      this.donationRepository.create({
        amount: it.amount,
        currency,
        paymentMethod: String(paymentMethod), // Ensure it's a string
        status: DonationStatusEnum.PENDING,
        donor: donor ?? undefined,
        projectId: it.targetType === 'project' ? it.targetEntity.id : undefined,
        campaignId:
          it.targetType === 'campaign' ? it.targetEntity.id : undefined,
      }),
    );
    return em.save(entities);
  }

  /** outcome→ DB + aggregates (NO heavy relations to avoid Unknown column errors) */
  private async applyPaymentOutcome(
    payment: Payment,
    outcome: MfOutcome,
    em: EntityManager,
    raw?: any,
  ) {
    payment.status = outcome;

    // Enrich with customer info if available and missing
    if (raw) {
      const customerName = raw.CustomerName || raw.customerName;
      const customerEmail = raw.CustomerEmail || raw.customerEmail;
      const customerMobile = raw.CustomerMobile || raw.customerMobile;

      if (!payment.customerName && customerName)
        payment.customerName = customerName;
      if (!payment.customerEmail && customerEmail)
        payment.customerEmail = customerEmail;
      if (!payment.customerMobile && customerMobile)
        payment.customerMobile = customerMobile;

      // Also update mfPaymentId if available
      const mfPaymentId = raw.Payments?.[0]?.PaymentId || raw.paymentId;
      if (!payment.mfPaymentId && mfPaymentId)
        payment.mfPaymentId = String(mfPaymentId);
    }

    await em.save(payment);

    if (outcome === 'pending') return { updatedDonations: [], outcome };

    const donations = await em.find(Donation, {
      where: { paymentId: payment.id },
      select: ['id', 'amount', 'status', 'projectId', 'campaignId', 'paidAt'],
    });

    const toUpdate: Donation[] = [];
    const projectDelta = new Map<string, { amount: number; count: number }>();
    const campaignDelta = new Map<string, { amount: number; count: number }>();

    for (const d of donations) {
      if (
        d.status === DonationStatusEnum.COMPLETED ||
        d.status === DonationStatusEnum.FAILED
      )
        continue;

      d.status =
        outcome === 'paid'
          ? DonationStatusEnum.COMPLETED
          : DonationStatusEnum.FAILED;

      if (outcome === 'paid') {
        (d as any).paidAt = d.paidAt || new Date();
        if (d.projectId) {
          const rec = projectDelta.get(d.projectId) || { amount: 0, count: 0 };
          rec.amount += Number(d.amount);
          rec.count += 1;
          projectDelta.set(d.projectId, rec);
        } else if (d.campaignId) {
          const rec = campaignDelta.get(d.campaignId) || {
            amount: 0,
            count: 0,
          };
          rec.amount += Number(d.amount);
          rec.count += 1;
          campaignDelta.set(d.campaignId, rec);
        }
      }

      toUpdate.push(d);
    }

    const [projects, campaigns] = await Promise.all([
      projectDelta.size
        ? em.find(Project, {
            where: { id: In([...projectDelta.keys()]) },
            select: ['id'], // Only need IDs to use increment
          })
        : Promise.resolve([]),
      campaignDelta.size
        ? em.find(Campaign, {
            where: { id: In([...campaignDelta.keys()]) },
            select: ['id'], // Only need IDs to use increment
          })
        : Promise.resolve([]),
    ]);

    // Use bulk operations for better performance and atomic safety
    const savePromises: Promise<any>[] = [];

    if (toUpdate.length > 0) {
      savePromises.push(em.save(Donation, toUpdate));
    }

    // Atomic SQL increments to prevent race conditions
    for (const p of projects) {
      const rec = projectDelta.get(p.id)!;
      savePromises.push(
        em.increment(Project, { id: p.id }, 'currentAmount', rec.amount),
      );
      savePromises.push(
        em.increment(Project, { id: p.id }, 'donationCount', rec.count),
      );
    }

    for (const c of campaigns) {
      const rec = campaignDelta.get(c.id)!;
      savePromises.push(
        em.increment(Campaign, { id: c.id }, 'currentAmount', rec.amount),
      );
      savePromises.push(
        em.increment(Campaign, { id: c.id }, 'donationCount', rec.count),
      );
    }

    if (savePromises.length > 0) {
      await Promise.all(savePromises);
    }

    return { updatedDonations: toUpdate.map((d) => d.id), outcome };
  }

  /**
   * Send notification for payment status change
   */
  private async sendPaymentNotification(
    payment: Payment,
    outcome: MfOutcome,
    donations: Donation[],
  ): Promise<void> {
    try {
      const donor = donations[0]?.donor;
      await this.notificationService.notifyPaymentStatusChange({
        paymentId: payment.id,
        invoiceId: payment.transactionId,
        status: outcome,
        amount: Number(payment.amount),
        currency: payment.currency,
        donorEmail: donor?.email,
        donorName: donor?.fullName,
        donorPhone: donor?.phoneNumber,
        donationIds: donations.map((d) => d.id),
      });
    } catch (error) {
      // Log but don't throw - notifications are non-critical
      console.error('Failed to send payment notification:', error);
    }
  }

  /**
   * Format a detailed response for payment status / reconciliation.
   * Centralizes the response structure to follow DRY principles.
   */
  private formatDetailedResponse(
    payment: Payment,
    outcome: MfOutcome,
    donations: Donation[],
  ) {
    const totalAmount = Number(payment.amount);
    const dateObj = payment.createdAt || new Date();

    // Mapping outcomes to user-friendly status
    const statusMap: Record<string, string> = {
      paid: 'Success',
      failed: 'Failed',
      pending: 'Pending',
    };

    return {
      outcome,
      status: statusMap[outcome] || outcome,
      invoiceId: payment.transactionId,
      totalAmount,
      currency: payment.currency,
      date: dateObj.toISOString().split('T')[0],
      time: dateObj.toTimeString().split(' ')[0],
      paymentId: payment.id,
      mfPaymentId: payment.mfPaymentId,
      items: donations.map((d) => {
        const amount = Number(d.amount);
        const name =
          d.project?.title || d.campaign?.title || 'General Donation';
        const type = d.projectId
          ? 'project'
          : d.campaignId
            ? 'campaign'
            : 'other';
        const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;

        return {
          name,
          type,
          amount,
          percentage: Math.round(percentage),
        };
      }),
      updatedDonations: donations.map((d) => d.id),
    };
  }

  /**
   * Main donation creation entry point.
   * Orchestrates donor resolution, donation persistence, and payment gateway integration.
   */
  public async create(createDonationDto: CreateDonationDto) {
    const correlationId = uuidv4().split('-')[0];
    this.logger.log(`[${correlationId}] Starting donation creation flow`);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const { donorInfo, donationItems, paymentMethod, currency } =
        createDonationDto;

      // STEP 1: Donor Resolution (Atomic & Concurrency-Safe)
      const donor = await this.resolveDonorSafe(
        donorInfo,
        qr.manager,
        correlationId,
      );

      // STEP 2: Donation Persistence (Local Records)
      // ADDED: Outbox Event for crash recovery
      const { donations, outboxEvent } = await this.createDonationEntities(
        donationItems,
        donor,
        currency,
        paymentMethod,
        qr.manager,
        correlationId,
      );

      // Commit the initial donation state before calling external APIs
      // This ensures we have a record even if the payment call times out
      await qr.commitTransaction();
      this.logger.debug(`[${correlationId}] Initial donations persisted`);

      // STEP 3: External Payment Integration
      const totalAmount = this.calcTotalAmount(donations);

      let createResult: CreatePaymentResult;
      try {
        this.logger.debug(`[${correlationId}] Calling payment gateway`);

        const customerName =
          donor?.fullName || donorInfo?.fullName || 'Anonymous Donor';

        createResult = await createPaymentForEntity(
          this.paymentService,
          this.paymentRepository,
          {
            entityId: donations[0].id, // Base reference
            amount: totalAmount,
            currency,
            description: `Donation for ${donations.length} items`,
            customerName,
            customerEmail: donor?.email || donorInfo?.email,
            customerMobile: donor?.phoneNumber || donorInfo?.phoneNumber,
            paymentMethodId: paymentMethod,
            metadata: {
              correlationId,
              donorId: donor?.id,
              donationIds: donations.map((d) => d.id),
            },
          },
        );
      } catch (error) {
        this.logger.error(
          `[${correlationId}] Payment gateway error: ${error.message}`,
        );
        // Mark donations as FAILED if the gateway call fails
        await this.donationRepository.update(
          donations.map((d) => d.id),
          { status: DonationStatusEnum.FAILED },
        );

        // Map configuration errors to user-friendly messages
        const activeProvider = this.paymentService.getActiveProviderName();
        if (this.isAuthConfigError(error)) {
          throw new BadRequestException({
            message: `Payment gateway configuration error. ${activeProvider} is not properly configured.`,
            details: this.getProviderConfigMessage(activeProvider),
            error: `${activeProvider} authentication failed`,
          });
        }
        throw error;
      }

      const { payment: savedPayment, paymentResult } = createResult as any;

      // ATTACH PROVIDER REFERENCE TO OUTBOX IMMEDIATELY
      // This ensures that even if the next steps fail, recovery can find the payment at the gateway
      await this.outboxService
        .attachProviderReference(
          outboxEvent.id,
          paymentResult.id,
          undefined, // providerPaymentId not available yet
          paymentResult.url,
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to attach provider reference to outbox: ${err.message}`,
          ),
        );

      // STEP 4: Link Donations to the saved Payment (New Transaction)
      const linkQr = this.dataSource.createQueryRunner();
      await linkQr.connect();
      await linkQr.startTransaction();

      try {
        // Requirement 2.STEP 6: Verify InvoiceId matches
        if (String(paymentResult.id) !== savedPayment.transactionId) {
          this.logger.error(
            `[${correlationId}] Payment mapping mismatch! Provider InvoiceId=${paymentResult.id}, Local transactionId=${savedPayment.transactionId}`,
          );
          throw new InternalServerErrorException(
            'Payment mapping integrity check failed',
          );
        }

        await this.linkDonationsToPayment(
          donations,
          savedPayment,
          paymentResult,
          linkQr.manager,
          correlationId,
          outboxEvent.id, // Resolve outbox in real-time
        );

        await linkQr.commitTransaction();

        // SECONDARY SAFETY LAYER: Immediate internal verification
        // This detects and recovers any micro-failures before final response
        await this.verifyAndResolveOutbox(outboxEvent.id, correlationId).catch(
          (err) => {
            this.logger.warn(
              `[${correlationId}] Real-time verification skipped: ${err.message}`,
            );
          },
        );

        // Background reconciliation and cache registration
        this.runPostCreationTasks(savedPayment, correlationId);

        this.logger.log(
          `[${correlationId}] Donation flow completed successfully`,
        );

        // Return EXACT same response structure as original
        return {
          donationIds: donations.map((d) => d.id),
          paymentUrl: paymentResult.url,
          totalAmount,
          invoiceId: paymentResult.id,
          lineItems: donations.map((d) => ({
            donationId: d.id,
            amount: Number(d.amount),
            projectId: d.projectId ?? null,
            campaignId: d.campaignId ?? null,
          })),
        };
      } catch (error) {
        await linkQr.rollbackTransaction();
        this.logger.error(
          `[${correlationId}] Link phase failed: ${error.message}`,
        );

        // INTERNAL SAFETY: Mark outbox as failed if link phase failed
        // This will be picked up by Cron recovery later
        if (outboxEvent) {
          await this.outboxService
            .markAsFailed(outboxEvent.id, error.message)
            .catch(() => {});
        }

        throw error;
        // In Step 4 (Link donations to payment record)
      } finally {
        await linkQr.release();
      }
    } catch (error) {
      // Rollback STEP 1 & 2 if they haven't been committed yet
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      this.logger.error(`[${correlationId}] Flow failed: ${error.message}`);
      throw error;
    } finally {
      await qr.release();
    }
  }

  /**
   * Helper: STEP 1 - Resolve donor with concurrency safety
   */
  private async resolveDonorSafe(
    donorInfo: any,
    em: EntityManager,
    correlationId: string,
  ): Promise<Donor | null> {
    this.logger.debug(`[${correlationId}] [PHASE:DONOR] Resolving donor`);
    return this.donorsService.resolveOrCreate(donorInfo, em);
  }

  /**
   * Helper: STEP 2 - Validate and create donation entities
   */
  private async createDonationEntities(
    donationItems: CreateDonationDto['donationItems'],
    donor: Donor | null,
    currency: string,
    paymentMethod: string,
    em: EntityManager,
    correlationId: string,
  ): Promise<{ donations: Donation[]; outboxEvent: any }> {
    this.logger.debug(`[${correlationId}] [PHASE:DONATION] Validating items`);
    const validatedItems = await this.validateItems(donationItems);
    const normalizedItems = this.normalizeItems(validatedItems);

    this.logger.debug(
      `[${correlationId}] [PHASE:DONATION] Persisting donations`,
    );
    const donations = await this.createDonations(
      normalizedItems,
      donor,
      currency,
      paymentMethod,
      em,
    );

    // Create Outbox Event in the same transaction for atomicity
    const outboxEvent = await this.outboxService.createEvent(
      'DONATION_PAYMENT_INIT',
      {
        donationIds: donations.map((d) => d.id),
        totalAmount: this.calcTotalAmount(donations),
        currency,
        paymentMethod,
        donorId: donor?.id,
        correlationId,
      },
      em,
    );

    this.logger.log(
      `[${correlationId}] PHASE: DONATION - Created ${donations.length} records with Outbox ${outboxEvent.id}`,
    );

    return { donations, outboxEvent };
  }

  /**
   * Helper: STEP 3 - Build external payment payload
   */
  private buildPaymentPayload(
    donations: Donation[],
    donor: Donor | null,
    donorInfo: CreateDonationDto['donorInfo'],
    currency: string,
    paymentMethod: string,
  ) {
    const quantity = donations.length;
    const totalAmount = this.calcTotalAmount(donations);
    const customerName =
      donor?.fullName ||
      donorInfo?.fullName ||
      (donorInfo?.isAnonymous ? 'Anonymous' : 'Anonymous Donor');

    return {
      amount: totalAmount,
      currency,
      referenceId: donations[0].id,
      description: `Donation for ${quantity} item(s)`,
      customerName,
      customerEmail: donor?.email || donorInfo?.email,
      customerMobile: donor?.phoneNumber || donorInfo?.phoneNumber,
      paymentMethodId: paymentMethod,
      metadata: {
        donationCount: quantity,
        projectIds: donations.map((d) => d.projectId).filter(Boolean),
        campaignIds: donations.map((d) => d.campaignId).filter(Boolean),
      },
    };
  }

  /**
   * Helper: STEP 4 - Link donations to payment record
   */
  private async linkDonationsToPayment(
    donations: Donation[],
    payment: Payment,
    rawResult: any,
    em: EntityManager,
    correlationId: string,
    outboxId: string,
  ) {
    this.logger.debug(`[${correlationId}] [PHASE:PAYMENT] Linking entities`);

    const donationIds = donations.map((d) => d.id);
    await em.update(Donation, donationIds, {
      paymentId: payment.id,
      paymentDetails: rawResult,
    });

    // Resolve Outbox Event in the same transaction for atomicity
    await this.outboxService.markAsProcessed(
      outboxId,
      payment.transactionId,
      em,
    );
  }

  /**
   * Private utility to check for authentication configuration errors
   */
  private isAuthConfigError(error: any): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      msg.includes('authentication failed') ||
      msg.includes('401') ||
      msg.includes('Unauthorized') ||
      msg.includes('API key')
    );
  }

  /**
   * Post-creation non-blocking tasks
   */
  private runPostCreationTasks(payment: Payment, correlationId: string) {
    if (this.reconciliationService) {
      try {
        this.reconciliationService.registerNewPayment(
          payment.id,
          payment.transactionId,
          payment.status,
        );
      } catch (err) {
        // Silently ignore cache registration errors
      }
    }

    setTimeout(() => {
      this.verifyPaymentStatusAsync(payment.transactionId).catch((err) => {
        this.logger.warn(
          `[${correlationId}] Background check skipped: ${err.message}`,
        );
      });
    }, 3000);
  }

  /**
   * Verify payment status asynchronously (non-blocking)
   * Used for automatic verification after payment creation
   * PaymentService will automatically check ExpiryDate
   *
   * This method is called after payment creation to verify status.
   * It handles cases where payment may not be immediately available in database
   * due to transaction commit delays or replication.
   */
  private async verifyPaymentStatusAsync(transactionId: string): Promise<void> {
    try {
      // Wait a short delay to allow payment provider to process the payment
      // and ensure database transaction is fully committed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // First, check if payment exists in database
      // If not found, it may be due to database replication delay
      // In this case, we skip verification rather than throwing an error
      const paymentExists = await this.paymentRepository.findOne({
        where: { transactionId },
      });

      if (!paymentExists) {
        // Payment not found - this can happen due to:
        // 1. Database replication delay
        // 2. Transaction not yet committed
        // 3. Payment was created in a different transaction context
        // Log and skip verification - reconciliation cron will handle it later
        console.warn(
          `Payment ${transactionId} not found in database for verification. Will be handled by reconciliation cron.`,
        );
        return;
      }

      // Payment exists, proceed with reconciliation
      await this.reconcilePayment(transactionId, 'InvoiceId');
    } catch (error) {
      // Log but don't throw - this is a background verification
      // Only log if it's not a NotFoundException (we already handled that above)
      if (!(error instanceof NotFoundException)) {
        console.error(
          `Background payment verification failed for transaction ${transactionId}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  /**
   * Handle payment webhook from payment provider
   * Supports MyFatoorah webhooks.
   *
   * Fixes:
   * - Reads TransactionStatus from Data.TransactionStatus, not webhookEvent.TransactionStatus only.
   * - Prevents String(undefined) from becoming a fake invoice id.
   * - Supports MyFatoorah V1/V2-like payload shapes.
   * - Does not return 400 when local payment is not found; it tries reconciliation first.
   * - Uses a DB transaction + pessimistic lock to reduce duplicate processing.
   * - Avoids downgrading a paid payment to failed/pending from a late webhook.
   */
  public async handlePaymentWebhook(
    methods: string[],
    webhookEvent: MyFatooraWebhookEvent,
  ) {
    const toNonEmptyString = (value: unknown): string | undefined => {
      if (value === undefined || value === null) return undefined;

      const text = String(value).trim();
      if (!text) return undefined;

      const lowered = text.toLowerCase();
      if (lowered === 'undefined' || lowered === 'null' || lowered === 'nan') {
        return undefined;
      }

      return text;
    };

    const normalizeLocalOutcome = (status: unknown): MfOutcome | 'unknown' => {
      const value = String(status ?? '')
        .trim()
        .toLowerCase();

      if (
        [
          'paid',
          'success',
          'successful',
          'completed',
          'complete',
          'captured',
        ].includes(value)
      ) {
        return 'paid';
      }

      if (
        [
          'failed',
          'fail',
          'failure',
          'canceled',
          'cancelled',
          'void',
          'expired',
        ].includes(value)
      ) {
        return 'failed';
      }

      if (
        [
          'pending',
          'inprogress',
          'in_progress',
          'processing',
          'initiated',
          'authorize',
          'authorized',
        ].includes(value)
      ) {
        return 'pending';
      }

      return 'unknown';
    };

    const data = (webhookEvent.Data ?? (webhookEvent as any)) as any;
    const webhookData = (webhookEvent.Data ?? webhookEvent) as any;

    const invoiceId =
      toNonEmptyString(webhookData?.InvoiceId) ||
      toNonEmptyString(webhookData?.Invoice?.Id) ||
      toNonEmptyString((webhookEvent as any)?.InvoiceId) ||
      toNonEmptyString((webhookEvent as any)?.EventEntityId);

    if (!invoiceId) {
      this.logger.warn('MyFatoorah webhook skipped: missing InvoiceId', {
        event: (webhookEvent as any)?.Event,
        eventName: (webhookEvent as any)?.EventName,
        eventEntityId: (webhookEvent as any)?.EventEntityId,
      });

      return {
        received: true,
        success: false,
        skipped: true,
        reason: 'missing_invoice_id',
      };
    }

    const payments = Array.isArray(webhookData?.Payments)
      ? webhookData.Payments
      : [];
    const firstPayment = payments[0];

    const providerPaymentId =
      toNonEmptyString(firstPayment?.PaymentId) ||
      toNonEmptyString(webhookData?.PaymentId) ||
      toNonEmptyString(webhookData?.Transaction?.PaymentId);

    const paymentMethodId =
      toNonEmptyString(firstPayment?.PaymentMethodId) ||
      toNonEmptyString(webhookData?.PaymentMethodId) ||
      toNonEmptyString(webhookData?.PaymentMethod) ||
      toNonEmptyString(webhookData?.Transaction?.PaymentMethodId);

    if (paymentMethodId) {
      this.logger.debug(
        `Webhook received for payment method: ${paymentMethodId}`,
      );
    }

    if (methods.length > 0) {
      const unsupported = methods.filter(
        (m) => !this.isSupportedPaymentMethod(m),
      );

      if (unsupported.length > 0) {
        this.logger.warn(
          `Webhook skipped due to unsupported payment methods: ${unsupported.join(', ')}`,
        );

        return {
          received: true,
          success: false,
          skipped: true,
          reason: 'unsupported_payment_methods',
          unsupported,
          invoiceId,
        };
      }
    }

    const rawStatuses = [
      ...payments.map(
        (p: any) =>
          p?.PaymentStatus ??
          p?.TransactionStatus ??
          p?.Status ??
          p?.Transaction?.Status,
      ),
      ...(webhookData?.InvoiceTransactions?.map((t: any) => t?.TransactionStatus || t?.Status) ?? []),
      ...(webhookData?.Transactions?.map((t: any) => t?.TransactionStatus || t?.Status) ?? []),
      webhookData?.TransactionStatus,
      webhookData?.Transaction?.Status,
      webhookData?.InvoiceStatus,
      webhookData?.Status,
      (webhookEvent as any)?.TransactionStatus,
      (webhookEvent as any)?.EventName, // Some V1 hooks use EventName for status
    ]
      .map(toNonEmptyString)
      .filter((x): x is string => Boolean(x));

    const txStatuses =
      rawStatuses.length > 0
        ? rawStatuses.map((status) => normalizeTxStatus(status))
        : [normalizeTxStatus('PENDING')];

    const invoiceStatus =
      webhookData?.InvoiceStatus ??
      webhookData?.Invoice?.Status ??
      webhookData?.TransactionStatus ??
      webhookData?.Transaction?.Status ??
      webhookData?.Status ??
      rawStatuses.find(s => normalizeTxStatus(s) === 'SUCCESS') ??
      rawStatuses[0] ??
      'PENDING';

    const outcome = deriveOutcome(invoiceStatus, txStatuses) as MfOutcome;

    const whereOptions: any[] = [{ transactionId: invoiceId }];
    if (providerPaymentId) {
      whereOptions.push({ mfPaymentId: providerPaymentId });
    }

    let existingPayment = await this.paymentRepository.findOne({
      where: whereOptions,
    });

    if (!existingPayment) {
      this.logger.warn(
        `Payment not found locally for webhook InvoiceId=${invoiceId}. Trying reconciliation recovery...`,
      );

      try {
        const recovered = await this.reconcilePayment(invoiceId, 'InvoiceId');

        return {
          received: true,
          success: true,
          recovered: true,
          invoiceId,
          providerPaymentId,
          outcome: (recovered as any)?.outcome ?? outcome,
          result: recovered,
        };
      } catch (error) {
        this.logger.warn(
          `Webhook reconciliation recovery failed for InvoiceId=${invoiceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        return {
          received: true,
          success: false,
          skipped: true,
          reason: 'payment_not_found_locally',
          invoiceId,
          providerPaymentId,
          outcome,
        };
      }
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const payment = await qr.manager.findOne(Payment, {
        where: { id: existingPayment.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        await qr.rollbackTransaction();

        return {
          received: true,
          success: false,
          skipped: true,
          reason: 'payment_disappeared_during_processing',
          invoiceId,
          providerPaymentId,
          outcome,
        };
      }

      const currentOutcome = normalizeLocalOutcome(payment.status);

      if (providerPaymentId && !payment.mfPaymentId) {
        payment.mfPaymentId = providerPaymentId;
        await qr.manager.save(payment);
      }

      if (currentOutcome === 'paid' && outcome !== 'paid') {
        await qr.commitTransaction();

        this.logger.warn(
          `Webhook ignored to avoid downgrading paid payment. InvoiceId=${invoiceId}, current=${payment.status}, incoming=${outcome}`,
        );

        return {
          received: true,
          success: true,
          skipped: true,
          reason: 'already_paid_no_downgrade',
          invoiceId,
          providerPaymentId,
          currentStatus: payment.status,
          incomingOutcome: outcome,
        };
      }

      if (currentOutcome === outcome && outcome !== 'pending') {
        await qr.commitTransaction();

        return {
          received: true,
          success: true,
          skipped: true,
          reason: 'already_processed',
          invoiceId,
          providerPaymentId,
          outcome,
        };
      }

      const normalizedRaw = {
        ...webhookData,
        paymentId: providerPaymentId,
        Payments:
          payments.length > 0
            ? payments
            : providerPaymentId || webhookData?.TransactionStatus
              ? [
                  {
                    PaymentId: providerPaymentId,
                    PaymentStatus: webhookData?.TransactionStatus,
                    PaymentMethodId: paymentMethodId,
                  },
                ]
              : [],
      };

      const { updatedDonations } = await this.applyPaymentOutcome(
        payment,
        outcome,
        qr.manager,
        normalizedRaw,
      );

      await qr.commitTransaction();

      if (outcome !== 'pending') {
        const donations = await this.donationRepository.find({
          where: { paymentId: payment.id },
          relations: ['donor'],
        });

        this.sendPaymentNotification(payment, outcome, donations).catch(
          (err) => {
            this.logger.warn(
              `Notification error after webhook processing: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          },
        );
      }

      return {
        received: true,
        success: true,
        invoiceId,
        providerPaymentId,
        outcome,
        updatedDonations,
      };
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }

      this.logger.error(
        `Webhook processing failed for InvoiceId=${invoiceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        received: true,
        success: false,
        skipped: true,
        reason: 'webhook_processing_error',
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await qr.release();
    }
  }
  /** Reconcile (on-demand / cron) */
  public async reconcilePayment(
    key: string,
    keyType: 'PaymentId' | 'InvoiceId' = 'InvoiceId',
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (!key) {
        throw new BadRequestException('Key is required');
      }

      /**
       * 1) Always fetch the latest status from payment provider first.
       *    This guarantees we rely on the gateway as the source of truth.
       *    PaymentService automatically:
       *    - Uses MyFatoorah as the payment provider
       *    - Uses keyType to optimize lookup (InvoiceId vs PaymentId)
       *    - Checks ExpiryDate and marks expired payments as failed
       *    - Maps provider-specific statuses to standard outcomes
       */
      let outcome: MfOutcome;
      let invoiceId: string;
      let raw: any;
      let statusResult: any;

      try {
        // Use PaymentService with keyType for optimized lookup
        // When keyType='PaymentId', provider goes directly to PaymentId lookup
        // instead of wasting an API call trying InvoiceId first
        statusResult = await this.paymentService.getPaymentStatus(
          key,
          keyType, // forward the key type
        );
        console.log('[DEBUG] PaymentService.getPaymentStatus result:', {
          outcome: statusResult.outcome,
          transactionId: statusResult.transactionId,
          paymentId: statusResult.paymentId,
          InvoiceStatus: statusResult.raw?.InvoiceStatus,
          PaymentStatuses: statusResult.raw?.Payments?.map(
            (p: any) => p.PaymentStatus,
          ),
        });
        outcome = statusResult.outcome as MfOutcome;
        invoiceId = statusResult.transactionId;
        raw = statusResult.raw;
      } catch (error) {
        // If payment not found in provider, check if we have it locally
        if (error instanceof NotFoundException) {
          // Try to find payment locally by transactionId
          // PaymentService tries InvoiceId first, then PaymentId automatically (for MyFatoorah)
          const localPayment = await this.paymentRepository.findOne({
            where: { transactionId: key } as any,
          });

          if (localPayment) {
            // Payment exists locally but not in payment provider
            // Check if we have expiry date in rawResponse
            const localRawResponse = localPayment.rawResponse;
            if (localRawResponse?.ExpireDate || localRawResponse?.expiryDate) {
              const expiryDate = new Date(
                localRawResponse.ExpireDate || localRawResponse.expiryDate,
              );
              const now = new Date();

              // If payment has expired, mark as failed
              if (expiryDate < now && localPayment.status === 'pending') {
                // Update local payment status to failed
                localPayment.status = 'failed';
                await this.paymentRepository.save(localPayment);

                throw new BadRequestException(
                  `Payment ${key} has expired. The invoice expired on ${expiryDate.toISOString()}.`,
                );
              }
            }

            // Payment exists locally but not in payment provider
            // This could mean the invoice expired or was deleted
            throw new NotFoundException(
              `Payment ${key} exists locally but not found in payment provider. The invoice may have expired or been deleted.`,
            );
          }

          // Payment doesn't exist in either place
          throw new NotFoundException(
            `Payment not found for ${keyType}: ${key}. Please verify the payment ID.`,
          );
        }
        // Re-throw other errors
        throw error;
      }

      if (!invoiceId) {
        throw new BadRequestException(
          'Unable to resolve InvoiceId from payment gateway response.',
        );
      }

      /**
       * 2) Find the local Payment record.
       *
       *    - If keyType is InvoiceId:
       *        We stored provider InvoiceId in `transactionId` when creating the payment.
       *
       *    - If keyType is PaymentId:
       *        We try by provider-specific payment ID if already stored.
       *        If not found, we fallback to `transactionId = invoiceId` resolved from provider.
       *
       *    This makes the reconciliation resilient whether the FE uses InvoiceId or PaymentId.
       */
      let payment = await this.paymentRepository.findOne({
        where:
          keyType === 'InvoiceId'
            ? { transactionId: invoiceId }
            : ([
                { mfPaymentId: key as any },
                { transactionId: invoiceId },
              ] as any),
      });

      // Recovery Logic: If local payment record is missing but we have a referenceId
      if (!payment) {
        this.logger.debug(
          `Local payment missing for ${keyType}: ${key}. Attempting recovery. statusResult: ${JSON.stringify(
            { ...statusResult, raw: undefined }, // avoid logging huge raw object
          )}`,
        );

        if (statusResult.referenceId) {
          // 1) Try to find the donation by the referenceId (donationId)
          const donation = await this.donationRepository.findOne({
            where: { id: statusResult.referenceId },
            relations: ['payment'],
          });

          if (donation) {
            if (donation.payment) {
              payment = donation.payment;
              // Update provider-specific IDs if missing
              if (payment.transactionId !== invoiceId) {
                payment.transactionId = invoiceId;
                await queryRunner.manager.save(payment);
              }
            } else {
              // Recovery: Payment entity was lost (e.g. transaction rollback) but donation exists
              payment = this.paymentRepository.create({
                transactionId: invoiceId,
                amount: statusResult.amount || 0,
                currency: statusResult.currency || 'KWD',
                status: outcome as any,
                paymentUrl: '', // URL is not recoverable from status
                rawResponse: raw,
                mfPaymentId: statusResult.paymentId,
              });
              await queryRunner.manager.save(payment);

              // Relink the donation
              donation.paymentId = payment.id;
              donation.payment = payment;
              await queryRunner.manager.save(donation);
            }
          }
        }

        // 2) DEEP RECOVERY: If still not found, search metadata in donations for this invoiceId
        // This handles cases where referenceId was somehow not set or lost
        if (!payment) {
          this.logger.debug(
            `ReferenceId recovery failed for ${invoiceId}. Trying deep metadata search.`,
          );
          // Standard MariaDB JSON search for the invoiceId in either the root 'id' or nested 'rawResponse.InvoiceId'
          const donationMetadataMatch = await this.donationRepository
            .createQueryBuilder('donation')
            .where(
              "JSON_VALUE(donation.paymentDetails, '$.id') = :invoiceId OR JSON_VALUE(donation.paymentDetails, '$.rawResponse.InvoiceId') = :invoiceId",
              { invoiceId },
            )
            .leftJoinAndSelect('donation.payment', 'payment')
            .getOne();

          if (donationMetadataMatch) {
            this.logger.log(
              `Deep recovery successful for InvoiceId: ${invoiceId}. Found donation: ${donationMetadataMatch.id}`,
            );
            if (donationMetadataMatch.payment) {
              payment = donationMetadataMatch.payment;
            } else {
              // Create missing payment and link
              payment = this.paymentRepository.create({
                transactionId: invoiceId,
                amount: statusResult.amount || 0,
                currency: statusResult.currency || 'KWD',
                status: outcome as any,
                paymentUrl: '',
                rawResponse: raw,
                mfPaymentId: statusResult.paymentId,
              });
              await queryRunner.manager.save(payment);

              donationMetadataMatch.paymentId = payment.id;
              donationMetadataMatch.payment = payment;
              await queryRunner.manager.save(donationMetadataMatch);
            }
          }
        }
      }

      if (!payment) {
        throw new NotFoundException(
          `Payment not found for ${keyType}: ${key} (InvoiceId=${invoiceId})`,
        );
      }

      /**
       * 3) Persist provider-specific PaymentId if available and not set yet.
       *    This improves future lookups using PaymentId directly.
       */
      const providerPaymentId =
        statusResult?.paymentId || raw?.Payments?.[0]?.PaymentId;

      if (providerPaymentId) {
        const paymentIdStr = String(providerPaymentId);
        // Store provider-specific payment ID (for MyFatoorah compatibility)
        if (!(payment as any).mfPaymentId && raw?.Payments?.[0]?.PaymentId) {
          (payment as any).mfPaymentId = paymentIdStr;
          await queryRunner.manager.save(payment);
        }
      }

      /**
       * 4) Apply the payment outcome to related donations & aggregates.
       *
       *    - If outcome = 'paid':
       *        Mark donations as COMPLETED, set paidAt, update project/campaign totals.
       *    - If outcome = 'failed':
       *        Mark pending donations as FAILED.
       *    - If outcome = 'pending':
       *        Leave donations as-is.
       *
       *    applyPaymentOutcome is idempotent: calling it multiple times
       *    for the same payment will not double-apply side effects.
       */
      const { updatedDonations } = await this.applyPaymentOutcome(
        payment,
        outcome,
        queryRunner.manager,
        raw, // Pass raw data for enrichment
      );

      await queryRunner.commitTransaction();

      // Send notification asynchronously
      const donations = await this.donationRepository.find({
        where: { paymentId: payment.id },
        relations: ['donor'],
      });
      this.sendPaymentNotification(payment, outcome, donations).catch((err) => {
        console.error('Notification error (non-critical):', err);
      });

      /**
       * 5) Return a normalized and detailed response for the frontend.
       *    This is what your success page can consume directly.
       */
      const detailedDonations = await this.donationRepository.find({
        where: { paymentId: payment.id },
        relations: ['project', 'campaign'],
      });

      return this.formatDetailedResponse(payment, outcome, detailedDonations);
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Enhanced error logging
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error('Payment reconciliation failed:', {
        error: errorMessage,
        stack: errorStack,
        key,
        keyType,
      });

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  public reconcilePaymentByInvoiceId(invoiceId: string) {
    return this.reconcilePayment(invoiceId, 'InvoiceId');
  }

  public findAll() {
    return this.donationRepository.find({
      relations: ['donor', 'project', 'campaign', 'payment'],
      order: { createdAt: 'DESC' },
    });
  }

  async list(query: PaginationQueryDto): Promise<CollectionResponseDto<Donation>> {
    const params = this.paginationService.normalizeParams(query);
    const { skip, take, search } = params;

    const queryBuilder = this.donationRepository
      .createQueryBuilder('donation')
      .leftJoinAndSelect('donation.donor', 'donor')
      .leftJoinAndSelect('donation.project', 'project')
      .leftJoinAndSelect('donation.campaign', 'campaign')
      .leftJoinAndSelect('donation.payment', 'payment');

    if (search) {
      queryBuilder.andWhere(
        '(donor.fullName LIKE :search OR donor.email LIKE :search OR project.title LIKE :search OR campaign.title LIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder
      .orderBy(`donation.${query.sortBy || 'createdAt'}`, query.sortOrder || 'DESC');

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return this.paginationService.createResponse(data, total, query);
  }

  public async findOne(id: string) {
    const donation = await this.donationRepository.findOne({
      where: { id },
      relations: ['donor', 'project', 'campaign', 'payment'],
    });
    if (!donation) throw new NotFoundException(`Donation #${id} not found`);
    return donation;
  }

  public findByProject(projectId: string) {
    return this.donationRepository.find({
      where: { projectId },
      relations: ['donor'],
      order: { createdAt: 'DESC' },
    });
  }

  public findByCampaign(campaignId: string) {
    return this.donationRepository.find({
      where: { campaignId },
      relations: ['donor'],
      order: { createdAt: 'DESC' },
    });
  }

  public findByPayment(paymentId: string) {
    return this.donationRepository.find({
      where: { paymentId },
      relations: ['donor'],
      order: { createdAt: 'DESC' },
    });
  }

  public findByDonor(donorId: string) {
    return this.donationRepository.find({
      where: { donorId },
      relations: ['project', 'campaign'],
      order: { createdAt: 'DESC' },
    });
  }
  public async update(id: string, dto: UpdateDonationDto) {
    const donation = await this.findOne(id);
    if (dto.projectId || dto.campaignId)
      throw new BadRequestException(
        'Cannot change project or campaign of an existing donation.',
      );
    Object.assign(donation, dto);
    return this.donationRepository.save(donation);
  }
  public async remove(id: string) {
    const result = await this.donationRepository.delete(id);
    if (!result.affected)
      throw new NotFoundException(`Donation #${id} not found`);
  }

  /**
   * Internal Safety Layer: Real-time Outbox Verification
   * Checks if an outbox event is processed, and if not, attempts immediate resolution.
   */
  private async verifyAndResolveOutbox(
    outboxId: string,
    correlationId: string,
  ): Promise<void> {
    const event = await this.dataSource
      .getRepository(OutboxEvent)
      .findOneBy({ id: outboxId });
    if (!event || event.status === OutboxStatus.PROCESSED) {
      return;
    }

    this.logger.log(
      `[${correlationId}] Outbox ${outboxId} still PENDING. Running immediate resolution.`,
    );

    const { donationIds } = event.payload;
    const donations = await this.donationRepository.find({
      where: { id: In(donationIds) },
      select: ['id', 'paymentId'],
    });

    const alreadyLinked = donations.find((d) => d.paymentId);
    if (alreadyLinked) {
      this.logger.log(
        `[${correlationId}] Donations already linked. Resolving outbox ${outboxId} immediately.`,
      );
      await this.outboxService.markAsProcessed(outboxId, undefined);
    }
  }

  /**
   * Recovers missed payments by querying MyFatoorah's webhook logs.
   * Useful when the server was down or webhooks failed to deliver.
   */
  async recoverMissedPayments(hours = 24) {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);

    this.logger.log(
      `Starting webhook recovery from ${start.toISOString()} to ${end.toISOString()}...`,
    );

    // Call GetWebhooks API via provider
    const response = await (this.paymentService as any).getWebhooks({
      Start: start.toISOString(),
      End: end.toISOString(),
      Status: 'Failed', // Only look for failed deliveries
      EventType: 'PAYMENT_STATUS_CHANGED',
    });

    if (!response.IsSuccess || !response.Data?.Items) {
      return { recovered: 0, total: 0, message: response.Message };
    }

    const items = response.Data.Items;
    let recoveredCount = 0;

    for (const item of items) {
      try {
        // Construct a webhook event from the log item
        const webhookEvent: MyFatooraWebhookEvent = {
          Data: item.Data,
          Event: {
            Code: item.EventCode,
            Name: item.EventName,
          },
        };

        // Process it using the existing handler
        const result = await this.handlePaymentWebhook([], webhookEvent);
        if (result.success && !result.skipped) {
          recoveredCount++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to recover webhook for EventEntityId=${item.EventEntityId}: ${error.message}`,
        );
      }
    }

    return {
      recovered: recoveredCount,
      total: items.length,
      message: `Recovery completed. Processed ${items.length} failed webhooks, recovered ${recoveredCount} payments.`,
    };
  }
}
