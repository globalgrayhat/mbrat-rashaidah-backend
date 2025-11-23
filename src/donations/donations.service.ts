/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotAcceptableException,
  NotFoundException,
  BadRequestException,
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

import { MyFatooraWebhookEvent } from '../common/interfaces/payment-service.interface';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
import {
  PaymentMethodEnum,
  isSupportedPaymentMethod,
} from '../common/constants/payment.constant';
import { MyFatooraService } from '../payment/myfatoora.service';
import { NotificationService } from '../common/services/notification.service';

import {
  deriveOutcome,
  normalizeTxStatus,
} from '../common/utils/mf-status.util';

type MfOutcome = 'paid' | 'failed' | 'pending';

@Injectable()
export class DonationsService {
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
    private readonly myFatooraService: MyFatooraService,
    private readonly notificationService: NotificationService,
  ) {}

  private isSupportedPaymentMethod(m: PaymentMethodEnum) {
    return isSupportedPaymentMethod(m);
  }
  private calcTotalAmount(ds: Donation[]) {
    return ds.reduce((a, d) => a + Number(d.amount), 0);
  }
  private calcQuantity(ds: Donation[]) {
    return ds.length;
  }

  private async handleDonorCreation(
    donorInfo: CreateDonationDto['donorInfo'],
    em: EntityManager,
  ): Promise<Donor | null> {
    // Allow anonymous donations - return null if no donor info provided
    if (!donorInfo) {
      return null;
    }

    const { userId, isAnonymous, fullName, email, phoneNumber } = donorInfo;

    // Handle registered user donations
    if (userId) {
      const [donor, user] = await Promise.all([
        this.donorRepository.findOneBy({ userId }),
        this.userRepository.findOneBy({ id: userId }),
      ]);

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      if (!donor) {
        // Create new donor record for registered user
        const created = this.donorRepository.create({
          userId,
          fullName: user.fullName || user.username,
          email: user.email,
          isAnonymous: isAnonymous ?? false,
        });
        return em.save(created);
      }

      // Update existing donor's anonymous preference if provided
      if (isAnonymous !== undefined) {
        donor.isAnonymous = isAnonymous;
      }
      return em.save(donor);
    }

    // Handle anonymous/unregistered donor donations
    // Allow donations with minimal info (just name, or completely anonymous)
    const donorName = fullName?.trim() || 'Anonymous Donor';
    const donorEmail = email?.trim() || undefined;
    const donorPhone = phoneNumber?.trim() || undefined;

    // Validate email format if provided
    if (donorEmail && !this.isValidEmail(donorEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    // Create anonymous donor record
    const newDonor = this.donorRepository.create({
      fullName: donorName,
      email: donorEmail,
      phoneNumber: donorPhone,
      isAnonymous: isAnonymous ?? true, // Default to anonymous for unregistered donors
    });

    return em.save(newDonor);
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
    paymentMethod: PaymentMethodEnum,
    em: EntityManager,
  ): Promise<Donation[]> {
    const entities = items.map((it) =>
      this.donationRepository.create({
        amount: it.amount,
        currency,
        paymentMethod,
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
  ) {
    payment.status = outcome;
    await em.save(payment);

    if (outcome === 'pending') return { updatedDonations: [], outcome };

    const donations = await this.donationRepository.find({
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
        (d as any).paidAt = new Date();
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
        ? this.projectRepository.find({
            where: { id: In([...projectDelta.keys()]) },
          })
        : Promise.resolve([]),
      campaignDelta.size
        ? this.campaignRepository.find({
            where: { id: In([...campaignDelta.keys()]) },
          })
        : Promise.resolve([]),
    ]);

    for (const p of projects) {
      const rec = projectDelta.get(p.id)!;
      p.currentAmount += rec.amount;
      p.donationCount += rec.count;
    }
    for (const c of campaigns) {
      const rec = campaignDelta.get(c.id)!;
      c.currentAmount += rec.amount;
      c.donationCount += rec.count;
    }

    // Use bulk operations for better performance
    const savePromises: Promise<any>[] = [];

    if (toUpdate.length > 0) {
      // Bulk update donations
      savePromises.push(em.save(Donation, toUpdate));
    }

    if (projects.length > 0) {
      // Bulk update projects
      savePromises.push(em.save(Project, projects));
    }

    if (campaigns.length > 0) {
      // Bulk update campaigns
      savePromises.push(em.save(Campaign, campaigns));
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

  public async create(createDonationDto: CreateDonationDto) {
    // Create an explicit DB transaction to ensure atomicity (all-or-nothing)
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const { donorInfo, donationItems, paymentMethod, currency } =
        createDonationDto;

      // 1) Validate supported payment method (domain guard)
      if (!this.isSupportedPaymentMethod(paymentMethod)) {
        throw new NotAcceptableException('Unsupported payment method');
      }

      // 2) Validate incoming donation items (existence, active donation flag, etc.)
      //    The result includes enriched targets (Project/Campaign)
      const validatedItems = await this.validateItems(donationItems);

      // 3) Create or update/attach a donor entity (if donorInfo is provided)
      const donor = await this.handleDonorCreation(donorInfo, qr.manager);

      // 4) Normalize items:
      //    If multiple entries target the same project/campaign, merge them into one line item.
      //    This yields cleaner accounting (one line per target) while still sharing one invoice.
      type NormItem = {
        amount: number;
        projectId?: string;
        campaignId?: string;
        targetType: 'project' | 'campaign';
        // keep the reference for clarity (not strictly needed after IDs are set)
        targetEntity: Project | Campaign;
      };

      const normalizedItemsMap = new Map<string, NormItem>();

      for (const it of validatedItems) {
        // Target key: project => p:<id>, campaign => c:<id>
        const key =
          it.targetType === 'project'
            ? `p:${it.targetEntity.id}`
            : `c:${it.targetEntity.id}`;

        const prev = normalizedItemsMap.get(key);
        if (prev) {
          // Merge amounts for same target (ensure number addition)
          prev.amount += Number(it.amount);
        } else {
          normalizedItemsMap.set(key, {
            amount: Number(it.amount),
            projectId:
              it.targetType === 'project' ? it.targetEntity.id : undefined,
            campaignId:
              it.targetType === 'campaign' ? it.targetEntity.id : undefined,
            targetType: it.targetType,
            targetEntity: it.targetEntity,
          });
        }
      }

      const normalizedItems = [...normalizedItemsMap.values()];

      // 5) Persist one Donation row per normalized line item
      const donations = await this.createDonations(
        normalizedItems.map((ni) => ({
          amount: ni.amount,
          projectId: ni.projectId,
          campaignId: ni.campaignId,
          targetEntity: ni.targetEntity,
          targetType: ni.targetType,
        })),
        donor,
        currency,
        paymentMethod,
        qr.manager,
      );

      // 6) Compute aggregated totals for the invoice
      const totalAmount = this.calcTotalAmount(donations); // sum of line items
      const quantity = this.calcQuantity(donations); // number of line items

      // 7) Create a payment (single invoice) at the payment gateway
      //    Use donor info if available; fall back to provided donorInfo or generic label
      //    For anonymous donors, use "Anonymous" as name but still allow optional email/phone
      const customerName =
        donor?.fullName ||
        donorInfo?.fullName ||
        (donorInfo?.isAnonymous ? 'Anonymous' : 'Anonymous Donor');
      const customerEmail = donor?.email || donorInfo?.email;
      const customerMobile = donor?.phoneNumber || donorInfo?.phoneNumber;

      let paymentResult;
      try {
        paymentResult = await this.myFatooraService.createPayment({
          amount: totalAmount,
          currency,
          donationId: donations[0].id, // Client reference; could be any donationId among this batch
          description: `Donation for ${quantity} item(s)`,
          customerName,
          customerEmail,
          customerMobile,
          paymentMethodId: paymentMethod,
        });
      } catch (error) {
        // If MyFatoorah API fails (401, etc.), provide a clear error message
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check if it's an authentication error
        if (
          errorMessage.includes('authentication failed') ||
          errorMessage.includes('401') ||
          errorMessage.includes('Unauthorized') ||
          errorMessage.includes('API key')
        ) {
          throw new BadRequestException({
            message:
              'Payment gateway configuration error. MyFatoorah API is not properly configured.',
            details: [
              'Please ensure the following environment variables are set correctly:',
              '- MYFATOORAH_API_KEY: Your MyFatoorah API key',
              '- MYFATOORAH_API_URL: MyFatoorah API URL (e.g., https://apitest.myfatoorah.com)',
              '- MYFATOORAH_CALLBACK_URL: Callback URL for successful payments',
              '- MYFATOORAH_ERROR_URL: Error URL for failed payments',
              '',
              'For testing, you can use MyFatoorah test credentials.',
              'Contact system administrator for assistance.',
            ].join('\n'),
            error: 'MyFatoorah authentication failed',
            statusCode: 400,
          });
        }

        // Re-throw other errors
        throw error;
      }

      // 8) Persist the Payment entity locally, then wire all Donation rows to it
      const paymentEntity = this.paymentRepository.create({
        transactionId: paymentResult.id, // MyFatoorah InvoiceId
        amount: totalAmount, // keep as integer if you're enforcing no decimals
        currency,
        paymentMethod,
        status: paymentResult.status, // typically "pending" here
        paymentUrl: paymentResult.url,
        rawResponse: JSON.stringify(paymentResult.rawResponse),
      });

      const savedPayment = await qr.manager.save(paymentEntity);

      // Link each donation to the saved payment and store the outbound gateway snapshot
      // Use bulk update for better performance
      for (const d of donations) {
        d.paymentId = savedPayment.id;
        d.payment = savedPayment;
        d.paymentDetails = paymentResult; // raw create response for reference/debug
      }
      // Bulk update donations with payment info
      await qr.manager.save(Donation, donations);

      // 9) Commit the transaction — everything is durable now
      await qr.commitTransaction();

      // 10) Automatically verify payment status after creation (non-blocking)
      // This helps catch any immediate payment completions and ensures data consistency
      this.verifyPaymentStatusAsync(paymentResult.id).catch((err) => {
        console.error(
          `Automatic payment verification failed for invoice ${paymentResult.id}:`,
          err,
        );
      });

      // 11) Return a clear payload including line items for FE to render the invoice details
      return {
        donationIds: donations.map((d) => d.id),
        paymentUrl: paymentResult.url,
        totalAmount, // grand total (sum of line items)
        invoiceId: paymentResult.id, // MyFatoorah InvoiceId
        lineItems: donations.map((d) => ({
          donationId: d.id,
          amount: Number(d.amount),
          projectId: d.projectId ?? null,
          campaignId: d.campaignId ?? null,
        })),
      };
    } catch (e) {
      // Any error => rollback changes to keep DB consistent
      await qr.rollbackTransaction();

      // Enhanced error logging for debugging
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;

      console.error('Donation creation failed:', {
        error: errorMessage,
        stack: errorStack,
        donationDto: {
          paymentMethod: createDonationDto.paymentMethod,
          currency: createDonationDto.currency,
          itemCount: createDonationDto.donationItems?.length || 0,
          hasDonorInfo: !!createDonationDto.donorInfo,
        },
      });

      throw e;
    } finally {
      // Always release the query runner
      await qr.release();
    }
  }

  /**
   * Verify payment status asynchronously (non-blocking)
   * Used for automatic verification after payment creation
   */
  private async verifyPaymentStatusAsync(invoiceId: string): Promise<void> {
    try {
      // Wait a short delay to allow MyFatoorah to process the payment
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await this.reconcilePayment(invoiceId, 'InvoiceId');
    } catch (error) {
      // Log but don't throw - this is a background verification
      console.error(
        `Background payment verification failed for invoice ${invoiceId}:`,
        error,
      );
    }
  }

  /** Webhook (Callback) من MyFatoorah */
  public async handlePaymentWebhook(
    methods: PaymentMethodEnum[],
    webhookEvent: MyFatooraWebhookEvent,
  ) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Extract payment method from webhook event if available
      const data = webhookEvent.Data ?? webhookEvent;
      const paymentMethodId =
        (data as any)?.Payments?.[0]?.PaymentMethodId ||
        (data as any)?.PaymentMethodId;

      // If payment method is provided in webhook, validate it
      // Otherwise, accept all methods (since we now support all MyFatoorah methods)
      if (paymentMethodId) {
        if (
          !this.isSupportedPaymentMethod(paymentMethodId as PaymentMethodEnum)
        ) {
          // Log warning but don't block - might be a new payment method
          console.warn(
            `Webhook received for potentially unsupported payment method: ${paymentMethodId}`,
          );
        }
      }

      // If methods array is provided and not empty, validate
      if (methods.length > 0) {
        const unsupported = methods.filter(
          (m) => !this.isSupportedPaymentMethod(m),
        );
        if (unsupported.length > 0) {
          throw new NotAcceptableException(
            `Unsupported payment methods: ${unsupported.join(', ')}`,
          );
        }
      }

      // Reuse the data variable declared above
      const invoiceId = String((data as any).InvoiceId);
      if (!invoiceId)
        throw new BadRequestException('Missing invoice ID in webhook');

      const payment = await this.paymentRepository.findOne({
        where: { transactionId: invoiceId },
      });
      if (!payment)
        throw new NotFoundException(
          `Payment not found for InvoiceId: ${invoiceId}`,
        );

      const firstPayment = (data as any)?.Payments?.[0];
      if (firstPayment?.PaymentId && !(payment as any).mfPaymentId) {
        (payment as any).mfPaymentId = String(firstPayment.PaymentId);
      }

      const txStatuses = (data as any)?.Payments?.map((p: any) =>
        normalizeTxStatus(p?.PaymentStatus),
      ) ?? [normalizeTxStatus((webhookEvent as any)?.TransactionStatus)];

      const outcome = deriveOutcome((data as any)?.InvoiceStatus, txStatuses);

      const { updatedDonations } = await this.applyPaymentOutcome(
        payment,
        outcome,
        qr.manager,
      );

      await qr.commitTransaction();

      // Send notification asynchronously (don't await to avoid blocking)
      const donations = await this.donationRepository.find({
        where: { paymentId: payment.id },
        relations: ['donor'],
      });
      this.sendPaymentNotification(payment, outcome, donations).catch((err) => {
        console.error('Notification error (non-critical):', err);
      });

      return { success: true, outcome, updatedDonations };
    } catch (e) {
      await qr.rollbackTransaction();

      // Enhanced error logging
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;

      console.error('Webhook processing failed:', {
        error: errorMessage,
        stack: errorStack,
        invoiceId: (webhookEvent.Data ?? webhookEvent)?.InvoiceId,
      });

      throw e;
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
       * 1) Always fetch the latest status from MyFatoorah first.
       *    This guarantees we rely on the gateway as the source of truth.
       */
      let outcome: MfOutcome;
      let invoiceId: string;
      let raw: any;

      try {
        const statusResult =
          await this.myFatooraService.getPaymentStatus(key, keyType);
        outcome = statusResult.outcome;
        invoiceId = statusResult.invoiceId;
        raw = statusResult.raw;
      } catch (error) {
        // If payment not found in MyFatoorah, check if we have it locally
        if (error instanceof NotFoundException) {
          // Try to find payment locally first
          const whereCondition =
            keyType === 'InvoiceId'
              ? { transactionId: key }
              : { mfPaymentId: key as any };
          const localPayment = await this.paymentRepository.findOne({
            where: whereCondition as any,
          });

          if (localPayment) {
            // Payment exists locally but not in MyFatoorah
            // This could mean the invoice expired or was deleted
            throw new NotFoundException(
              `Payment ${key} exists locally but not found in MyFatoorah. The invoice may have expired or been deleted.`,
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
       *        We stored MyFatoorah InvoiceId in `transactionId` when creating the payment.
       *
       *    - If keyType is PaymentId:
       *        We try by `mfPaymentId` (MyFatoorah PaymentId) if already stored.
       *        If not found, we fallback to `transactionId = invoiceId` resolved from MyFatoorah.
       *
       *    This makes the reconciliation resilient whether the FE uses InvoiceId or PaymentId.
       */
      const payment = await this.paymentRepository.findOne({
        where:
          keyType === 'InvoiceId'
            ? { transactionId: invoiceId }
            : ([
                { mfPaymentId: key as any },
                { transactionId: invoiceId },
              ] as any),
      });

      if (!payment) {
        throw new NotFoundException(
          `Payment not found for ${keyType}: ${key} (InvoiceId=${invoiceId})`,
        );
      }

      /**
       * 3) Persist MyFatoorah PaymentId (mfPaymentId) if available and not set yet.
       *    This improves future lookups using PaymentId directly.
       */
      const mfPaymentId =
        raw?.Payments?.[0]?.PaymentId != null
          ? String(raw.Payments[0].PaymentId)
          : null;

      if (mfPaymentId && !(payment as any).mfPaymentId) {
        (payment as any).mfPaymentId = mfPaymentId;
        await queryRunner.manager.save(payment);
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
        outcome as MfOutcome,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      // Send notification asynchronously
      const donations = await this.donationRepository.find({
        where: { paymentId: payment.id },
        relations: ['donor'],
      });
      this.sendPaymentNotification(
        payment,
        outcome as MfOutcome,
        donations,
      ).catch((err) => {
        console.error('Notification error (non-critical):', err);
      });

      /**
       * 5) Return a normalized response for the frontend.
       *    This is what your success page can consume directly.
       */
      return {
        outcome,
        paymentId: payment.id,
        invoiceId: payment.transactionId,
        mfPaymentId: (payment as any).mfPaymentId || mfPaymentId || null,
        updatedDonations,
      };
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
}
