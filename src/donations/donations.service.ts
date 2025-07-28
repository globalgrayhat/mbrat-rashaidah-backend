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
import {
  MyFatooraWebhookEvent,
  MyFatoorahGetPaymentStatusData,
} from '../common/interfaces/payment-service.interface';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
import { PaymentMethodEnum } from '../common/constants/payment.constant';
import { MyFatooraService } from '../payment/myfatoora.service';

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly myFatooraService: MyFatooraService,
  ) {}

  // ------------------------------ Pure helpers ------------------------------
  private isSupportedPaymentMethod(m: PaymentMethodEnum): boolean {
    return [PaymentMethodEnum.KNET, PaymentMethodEnum.VISA].includes(m);
  }
  private calcTotalAmount(ds: Donation[]): number {
    return ds.reduce((a, d) => a + Number(d.amount), 0);
  }
  private calcQuantity(ds: Donation[]): number {
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

  /** Validate items concurrently (projects/campaigns fetched in parallel). */
  private async validateItems(
    donationItems: CreateDonationDto['donationItems'],
  ): Promise<
    {
      amount: number;
      projectId?: string;
      campaignId?: string;
      targetEntity: Project | Campaign;
      targetType: 'project' | 'campaign';
    }[]
  > {
    if (!Array.isArray(donationItems) || donationItems.length === 0) {
      throw new BadRequestException(
        'At least one donation item (project or campaign) is required.',
      );
    }

    // Split ids
    const projectIds = donationItems
      .map((i) => i?.projectId)
      .filter((x): x is string => Boolean(x));
    const campaignIds = donationItems
      .map((i) => i?.campaignId)
      .filter((x): x is string => Boolean(x));

    // Batch fetch
    const [projects, campaigns] = await Promise.all([
      projectIds.length
        ? this.projectRepository.find({ where: { id: In(projectIds) } })
        : Promise.resolve([]),
      campaignIds.length
        ? this.campaignRepository.find({ where: { id: In(campaignIds) } })
        : Promise.resolve([]),
    ]);

    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

    // Build output
    const out = donationItems.map((item) => {
      if (item?.projectId) {
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
      if (item?.campaignId) {
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

    return out;
  }

  /** Create donations in bulk (single save). */
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
    return em.save(entities); // bulk save
  }

  private mapMfOutcome(
    invoiceStatus?: number,
    transactionStatus?: string,
  ): MfOutcome {
    const success = invoiceStatus === 4 || transactionStatus === 'SUCCESS';
    const failed = invoiceStatus === 1 || transactionStatus === 'FAILED';
    if (success) return 'paid';
    if (failed) return 'failed';
    return 'pending';
  }

  /** Batch-update: payment + donations + project/campaign aggregates. */
  private async applyPaymentOutcome(
    payment: Payment,
    outcome: MfOutcome,
    em: EntityManager,
  ): Promise<{ updatedDonations: string[]; outcome: MfOutcome }> {
    payment.status = outcome;
    await em.save(payment);

    if (outcome !== 'paid' && outcome !== 'failed') {
      return { updatedDonations: [], outcome };
    }

    const donations = await this.donationRepository.find({
      where: { paymentId: payment.id },
      relations: ['project', 'campaign'],
    });

    const toUpdate: Donation[] = [];
    const projectDelta = new Map<
      string,
      { entity: Project; amount: number; count: number }
    >();
    const campaignDelta = new Map<
      string,
      { entity: Campaign; amount: number; count: number }
    >();

    for (const d of donations) {
      if (
        d.status === DonationStatusEnum.COMPLETED ||
        d.status === DonationStatusEnum.FAILED
      ) {
        continue;
      }

      d.status =
        outcome === 'paid'
          ? DonationStatusEnum.COMPLETED
          : DonationStatusEnum.FAILED;

      if (outcome === 'paid') {
        d.paidAt = new Date();
        if (d.project) {
          const rec = projectDelta.get(d.project.id) || {
            entity: d.project,
            amount: 0,
            count: 0,
          };
          rec.amount += Number(d.amount);
          rec.count += 1;
          projectDelta.set(d.project.id, rec);
        } else if (d.campaign) {
          const rec = campaignDelta.get(d.campaign.id) || {
            entity: d.campaign,
            amount: 0,
            count: 0,
          };
          rec.amount += Number(d.amount);
          rec.count += 1;
          campaignDelta.set(d.campaign.id, rec);
        }
      }

      toUpdate.push(d);
    }

    // Apply deltas
    for (const { entity, amount, count } of projectDelta.values()) {
      entity.currentAmount += amount;
      entity.donationCount += count;
    }
    for (const { entity, amount, count } of campaignDelta.values()) {
      entity.currentAmount += amount;
      entity.donationCount += count;
    }

    // Bulk saves in parallel
    await Promise.all([
      toUpdate.length ? em.save(toUpdate) : Promise.resolve(),
      projectDelta.size
        ? em.save([...projectDelta.values()].map((v) => v.entity))
        : Promise.resolve(),
      campaignDelta.size
        ? em.save([...campaignDelta.values()].map((v) => v.entity))
        : Promise.resolve(),
    ]);

    return { updatedDonations: toUpdate.map((d) => d.id), outcome };
  }

  // ------------------------------ Public API ------------------------------

  public async create(createDonationDto: CreateDonationDto) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const { donorInfo, donationItems, paymentMethod, currency } =
        createDonationDto;

      if (!this.isSupportedPaymentMethod(paymentMethod)) {
        throw new NotAcceptableException('Unsupported payment method');
      }

      // Validate & donor in parallel
      const [items, donor] = await Promise.all([
        this.validateItems(donationItems),
        this.handleDonorCreation(donorInfo, qr.manager),
      ]);

      const donations = await this.createDonations(
        items,
        donor,
        currency,
        paymentMethod,
        qr.manager,
      );

      const [totalAmount, quantity] = [
        this.calcTotalAmount(donations),
        this.calcQuantity(donations),
      ];

      // Create invoice
      const paymentResultPromise = this.myFatooraService.createPayment({
        amount: totalAmount,
        currency,
        donationId: donations[0].id,
        description: `Donation for ${quantity} item(s)`,
        customerName: donor?.fullName || donorInfo?.fullName || 'Anonymous',
        customerEmail: donor?.email || donorInfo?.email,
        customerMobile: donor?.phoneNumber || donorInfo?.phoneNumber,
        paymentMethodId: paymentMethod,
      });

      const paymentResult = await paymentResultPromise;

      // Persist payment then link donations (bulk)
      const paymentEntity = this.paymentRepository.create({
        transactionId: paymentResult.id,
        amount: totalAmount,
        currency,
        paymentMethod,
        status: paymentResult.status,
        paymentUrl: paymentResult.url,
        rawResponse:
          typeof paymentResult.rawResponse === 'object'
            ? JSON.stringify(paymentResult.rawResponse)
            : String(paymentResult.rawResponse),
      });

      const savedPayment = await qr.manager.save(paymentEntity);

      donations.forEach((d) => {
        d.paymentId = savedPayment.id;
        d.payment = savedPayment;
        d.paymentDetails = paymentResult;
      });
      await qr.manager.save(donations); // bulk link

      await qr.commitTransaction();
      return {
        donationIds: donations.map((d) => d.id),
        paymentUrl: paymentResult.url,
        totalAmount,
        invoiceId: paymentResult.id,
      };
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  public async handlePaymentWebhook(
    methods: PaymentMethodEnum[],
    webhookEvent: MyFatooraWebhookEvent,
  ) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      if (!methods.every((m) => this.isSupportedPaymentMethod(m))) {
        throw new NotAcceptableException('Unsupported payment method');
      }

      const data = webhookEvent.Data ?? webhookEvent;
      const invoiceId = String(data.InvoiceId);
      if (!invoiceId) throw new BadRequestException('Missing invoice ID.');

      const payment = await this.paymentRepository.findOne({
        where: { transactionId: invoiceId },
      });
      if (!payment)
        throw new NotFoundException(
          `Payment not found for InvoiceId: ${invoiceId}`,
        );

      const outcome = this.mapMfOutcome(
        (data as any)?.InvoiceStatus as number | undefined,
        webhookEvent.TransactionStatus,
      );

      await this.applyPaymentOutcome(payment, outcome, qr.manager);

      await qr.commitTransaction();
      return { success: true, outcome };
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  /** Reconcile by calling GetPaymentStatus (usable by cron or on-demand). */
  public async reconcilePaymentByInvoiceId(invoiceId: string) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const payment = await this.paymentRepository.findOne({
        where: { transactionId: invoiceId },
      });
      if (!payment) {
        throw new NotFoundException(
          `Payment not found for InvoiceId: ${invoiceId}`,
        );
      }

      const status: MyFatoorahGetPaymentStatusData =
        await this.myFatooraService.getPaymentStatus(invoiceId);

      const invStatus = (status as any)?.InvoiceStatus as number | undefined;
      const txStatus = (status as any)?.TransactionStatus as string | undefined;

      const outcome = this.mapMfOutcome(invStatus, txStatus);
      const { updatedDonations } = await this.applyPaymentOutcome(
        payment,
        outcome,
        qr.manager,
      );

      await qr.commitTransaction();
      return {
        invoiceId,
        outcome,
        paymentId: payment.id,
        updatedDonations,
      };
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  // ------------------------------ Queries ------------------------------
  public async findAll(): Promise<Donation[]> {
    return this.donationRepository.find({
      relations: ['donor', 'project', 'campaign', 'payment'],
      order: { createdAt: 'DESC' },
    });
  }
  public async findOne(donationId: string): Promise<Donation> {
    const donation = await this.donationRepository.findOne({
      where: { id: donationId },
      relations: ['donor', 'project', 'campaign', 'payment'],
    });
    if (!donation)
      throw new NotFoundException(`Donation #${donationId} not found`);
    return donation;
  }
  public async findByProject(projectId: string): Promise<Donation[]> {
    return this.donationRepository.find({
      where: { projectId },
      relations: ['donor'],
      order: { createdAt: 'DESC' },
    });
  }
  public async findByCampaign(campaignId: string): Promise<Donation[]> {
    return this.donationRepository.find({
      where: { campaignId },
      relations: ['donor'],
      order: { createdAt: 'DESC' },
    });
  }
  public async findByDonor(donorId: string): Promise<Donation[]> {
    return this.donationRepository.find({
      where: { donorId },
      relations: ['project', 'campaign'],
      order: { createdAt: 'DESC' },
    });
  }
  public async update(
    donationId: string,
    updateDonationDto: UpdateDonationDto,
  ): Promise<Donation> {
    const donation = await this.findOne(donationId);
    if (
      updateDonationDto.projectId !== undefined ||
      updateDonationDto.campaignId !== undefined
    ) {
      throw new BadRequestException(
        'Cannot change project or campaign of an existing donation.',
      );
    }
    Object.assign(donation, updateDonationDto);
    return this.donationRepository.save(donation);
  }
  public async remove(donationId: string): Promise<void> {
    const result = await this.donationRepository.delete(donationId);
    if (result.affected === 0) {
      throw new NotFoundException(`Donation #${donationId} not found`);
    }
  }
}
