/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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

export enum MFInvoiceStatus {
  Pending = 'Pending',
  Paid = 'Paid',
  Canceled = 'Canceled',
}
export enum MFTransactionStatus {
  InProgress = 'InProgress',
  Succss = 'Succss',
  Failed = 'Failed',
  Canceled = 'Canceled',
  Authorize = 'Authorize',
}
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

  private isSupportedPaymentMethod(m: PaymentMethodEnum) {
    return [PaymentMethodEnum.KNET, PaymentMethodEnum.VISA].includes(m);
  }
  private calcTotalAmount(ds: Donation[]) {
    return ds.reduce((a, d) => a + Number(d.amount), 0);
  }
  private calcQuantity(ds: Donation[]) {
    return ds.length;
  }

  private mapMfOutcome(
    invoiceStatus?: MFInvoiceStatus,
    txStatuses: MFTransactionStatus[] = [],
  ): MfOutcome {
    if (
      invoiceStatus === MFInvoiceStatus.Paid ||
      txStatuses.includes(MFTransactionStatus.Succss)
    )
      return 'paid';
    if (
      invoiceStatus === MFInvoiceStatus.Canceled ||
      (txStatuses.length &&
        txStatuses.every((s) =>
          [MFTransactionStatus.Failed, MFTransactionStatus.Canceled].includes(
            s,
          ),
        ))
    )
      return 'failed';
    return 'pending';
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
          targetEntity: project as Project,
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
          targetEntity: campaign as Campaign,
          targetType: 'campaign' as const,
        };
      }
      throw new BadRequestException(
        'Each donation item must reference a project or campaign.',
      );
    });
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
      )
        continue;

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

    for (const { entity, amount, count } of projectDelta.values()) {
      entity.currentAmount += amount;
      entity.donationCount += count;
    }
    for (const { entity, amount, count } of campaignDelta.values()) {
      entity.currentAmount += amount;
      entity.donationCount += count;
    }

    await Promise.all([
      toUpdate.length ? em.save(toUpdate) : undefined,
      projectDelta.size
        ? em.save([...projectDelta.values()].map((v) => v.entity))
        : undefined,
      campaignDelta.size
        ? em.save([...campaignDelta.values()].map((v) => v.entity))
        : undefined,
    ]);

    return { updatedDonations: toUpdate.map((d) => d.id), outcome };
  }

  public async create(createDonationDto: CreateDonationDto) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const { donorInfo, donationItems, paymentMethod, currency } =
        createDonationDto;

      if (!this.isSupportedPaymentMethod(paymentMethod))
        throw new NotAcceptableException('Unsupported payment method');

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

      const totalAmount = this.calcTotalAmount(donations);
      const quantity = this.calcQuantity(donations);

      const paymentResult = await this.myFatooraService.createPayment({
        amount: totalAmount,
        currency,
        donationId: donations[0].id,
        description: `Donation for ${quantity} item(s)`,
        customerName: donor?.fullName || donorInfo?.fullName || 'Anonymous',
        customerEmail: donor?.email || donorInfo?.email,
        customerMobile: donor?.phoneNumber || donorInfo?.phoneNumber,
        paymentMethodId: paymentMethod,
      });

      const paymentEntity = this.paymentRepository.create({
        transactionId: paymentResult.id,
        amount: totalAmount,
        currency,
        paymentMethod,
        status: paymentResult.status,
        paymentUrl: paymentResult.url,
        rawResponse: JSON.stringify(paymentResult.rawResponse),
      });
      const savedPayment = await qr.manager.save(paymentEntity);

      donations.forEach((d) => {
        d.paymentId = savedPayment.id;
        d.payment = savedPayment;
        d.paymentDetails = paymentResult;
      });
      await qr.manager.save(donations);

      await qr.commitTransaction();
      return {
        donationIds: donations.map((d) => d.id),
        paymentUrl: paymentResult.url,
        totalAmount,
        invoiceId: paymentResult.id,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
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
      if (!methods.every((m) => this.isSupportedPaymentMethod(m)))
        throw new NotAcceptableException('Unsupported payment method');

      const data = webhookEvent.Data ?? webhookEvent;
      const invoiceId = String(data.InvoiceId);
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
        (payment as any).mfPaymentId = firstPayment.PaymentId;
      }

      const txStatuses: MFTransactionStatus[] = (data as any)?.Payments?.map(
        (p: any) => p.PaymentStatus,
      ) ?? [webhookEvent.TransactionStatus as MFTransactionStatus];

      const outcome = this.mapMfOutcome(
        data.InvoiceStatus as unknown as MFInvoiceStatus,
        txStatuses,
      );

      await this.applyPaymentOutcome(payment, outcome, qr.manager);

      await qr.commitTransaction();
      return { success: true, outcome };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  public async reconcilePayment(
    key: string,
    keyType: 'PaymentId' | 'InvoiceId' = 'InvoiceId',
  ) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const payment = await this.paymentRepository.findOne({
        where:
          keyType === 'InvoiceId'
            ? { transactionId: key }
            : ({ mfPaymentId: key } as any),
      });
      if (!payment)
        throw new NotFoundException(`Payment not found for ${keyType}: ${key}`);

      const { raw } = await this.myFatooraService.getPaymentStatus(
        key,
        keyType,
      );

      const invoiceStatus = raw.InvoiceStatus as unknown as MFInvoiceStatus;
      const txStatuses: MFTransactionStatus[] =
        raw.Payments?.map((p) => p.PaymentStatus as MFTransactionStatus) ?? [];

      const finalOutcome = this.mapMfOutcome(invoiceStatus, txStatuses);

      const { updatedDonations } = await this.applyPaymentOutcome(
        payment,
        finalOutcome,
        qr.manager,
      );

      await qr.commitTransaction();
      return {
        outcome: finalOutcome,
        paymentId: payment.id,
        updatedDonations,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
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
