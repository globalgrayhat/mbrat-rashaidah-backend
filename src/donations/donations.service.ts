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
import { PaymentMethodEnum } from '../common/constants/payment.constant';
import { MyFatooraService } from '../payment/myfatoora.service';

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
  ) {}

  private isSupportedPaymentMethod(m: PaymentMethodEnum) {
    return [PaymentMethodEnum.KNET, PaymentMethodEnum.VISA].includes(m);
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
    if (!donorInfo) return null;
    const { userId, isAnonymous, fullName, email, phoneNumber } = donorInfo;

    if (userId) {
      const [donor, user] = await Promise.all([
        this.donorRepository.findOneBy({ userId }),
        this.userRepository.findOneBy({ id: userId }),
      ]);
      if (!donor) {
        if (!user) throw new NotFoundException('User not found');
        const created = this.donorRepository.create({
          userId,
          fullName: user.fullName || user.username,
          email: user.email,
          isAnonymous: isAnonymous ?? false,
        });
        return em.save(created);
      }
      donor.isAnonymous = isAnonymous ?? donor.isAnonymous;
      return em.save(donor);
    }

    const newDonor = this.donorRepository.create({
      fullName: fullName || 'Anonymous Donor',
      email,
      phoneNumber,
      isAnonymous: isAnonymous ?? false,
    });
    return em.save(newDonor);
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

    await Promise.all([
      toUpdate.length ? em.save(toUpdate) : undefined,
      projects.length ? em.save(projects) : undefined,
      campaigns.length ? em.save(campaigns) : undefined,
    ]);

    return { updatedDonations: toUpdate.map((d) => d.id), outcome };
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
      const paymentResult = await this.myFatooraService.createPayment({
        amount: totalAmount,
        currency,
        donationId: donations[0].id, // Client reference; could be any donationId among this batch
        description: `Donation for ${quantity} item(s)`,
        customerName: donor?.fullName || donorInfo?.fullName || 'Anonymous',
        customerEmail: donor?.email || donorInfo?.email,
        customerMobile: donor?.phoneNumber || donorInfo?.phoneNumber,
        paymentMethodId: paymentMethod,
      });

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
      for (const d of donations) {
        d.paymentId = savedPayment.id;
        d.payment = savedPayment;
        d.paymentDetails = paymentResult; // raw create response for reference/debug
      }
      await qr.manager.save(donations);

      // 9) Commit the transaction — everything is durable now
      await qr.commitTransaction();

      // 10) Return a clear payload including line items for FE to render the invoice details
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
      throw e;
    } finally {
      // Always release the query runner
      await qr.release();
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
      if (!methods.every((m) => this.isSupportedPaymentMethod(m)))
        throw new NotAcceptableException('Unsupported payment method');

      const data = webhookEvent.Data ?? webhookEvent;
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

      await this.applyPaymentOutcome(payment, outcome, qr.manager);

      await qr.commitTransaction();
      return { success: true, outcome };
    } catch (e) {
      await qr.rollbackTransaction();
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
      const { outcome, invoiceId, raw } =
        await this.myFatooraService.getPaymentStatus(key, keyType);

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
