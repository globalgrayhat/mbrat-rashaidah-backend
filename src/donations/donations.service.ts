import {
  Injectable,
  NotAcceptableException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { Donation } from './entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Donor } from '../donor/entities/donor.entity';
import { User } from '../user/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';
import {
  PaymentResult,
  MyFatooraWebhookEvent,
} from '../common/interfaces/payment-service.interface';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
import { PaymentMethodEnum } from '../common/constants/payment.constant';
import { MyFatooraService } from '../payment/myfatoora.service';

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

  private async validateDonationTarget(dto: CreateDonationDto): Promise<{
    targetEntity: Project | Campaign;
    targetType: 'project' | 'campaign';
  }> {
    if (dto.projectId) {
      const project = await this.projectRepository.findOneBy({
        id: dto.projectId,
      });
      if (!project) throw new NotFoundException('Project not found');
      if (!project.isDonationActive)
        throw new NotAcceptableException(
          'Donations are not active for this project',
        );
      return { targetEntity: project, targetType: 'project' };
    }
    if (dto.campaignId) {
      const campaign = await this.campaignRepository.findOneBy({
        id: dto.campaignId,
      });
      if (!campaign) throw new NotFoundException('Campaign not found');
      if (!campaign.isDonationActive)
        throw new NotAcceptableException(
          'Donations are not active for this campaign',
        );
      return { targetEntity: campaign, targetType: 'campaign' };
    }
    throw new BadRequestException(
      'Donation must be linked to either a project or a campaign.',
    );
  }

  private async handleDonorCreation(
    donorInfo: CreateDonationDto['donorInfo'],
    entityManager: EntityManager,
  ): Promise<Donor | null> {
    if (!donorInfo) return null;

    const { userId, isAnonymous, fullName, email, phoneNumber } = donorInfo;

    if (userId) {
      let donor = await this.donorRepository.findOneBy({ userId });
      if (!donor) {
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) throw new NotFoundException('User not found');
        donor = this.donorRepository.create({
          userId,
          fullName: user.fullName || user.username,
          email: user.email,
          isAnonymous: isAnonymous ?? false,
        });
        return entityManager.save(donor);
      }
      if (isAnonymous !== undefined) {
        donor.isAnonymous = isAnonymous;
        return entityManager.save(donor);
      }
      return donor;
    }

    const donor = this.donorRepository.create({
      fullName: fullName || 'Anonymous Donor',
      email,
      phoneNumber,
      isAnonymous: isAnonymous ?? false,
    });
    return entityManager.save(donor);
  }

  private isSupportedPaymentMethod(paymentMethod: PaymentMethodEnum): boolean {
    return [PaymentMethodEnum.KNET, PaymentMethodEnum.VISA].includes(
      paymentMethod,
    );
  }

  public async create(createDonationDto: CreateDonationDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { targetEntity, targetType } =
        await this.validateDonationTarget(createDonationDto);
      const donor = await this.handleDonorCreation(
        createDonationDto.donorInfo,
        queryRunner.manager,
      );

      const donation = this.donationRepository.create({
        amount: createDonationDto.amount,
        currency: createDonationDto.currency,
        paymentMethod: createDonationDto.paymentMethod,
        status: DonationStatusEnum.PENDING,
        donor: donor ?? undefined,
        projectId: targetType === 'project' ? targetEntity.id : undefined,
        campaignId: targetType === 'campaign' ? targetEntity.id : undefined,
      });
      await queryRunner.manager.save(donation);

      if (!this.isSupportedPaymentMethod(donation.paymentMethod)) {
        throw new NotAcceptableException('Unsupported payment method.');
      }

      const paymentResult: PaymentResult =
        await this.myFatooraService.createPayment({
          amount: donation.amount,
          currency: donation.currency,
          donationId: donation.id,
          description: `Donation for ${'title' in targetEntity ? targetEntity.title : ''}`,
          customerName: donor?.fullName || 'Anonymous',
          customerEmail: donor?.email || createDonationDto.donorInfo?.email,
        });

      donation.paymentId = paymentResult.id;
      donation.paymentDetails = paymentResult;
      await queryRunner.manager.save(donation);

      await queryRunner.commitTransaction();
      return { donationId: donation.id, paymentUrl: paymentResult.url };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  public async handlePaymentWebhook(
    paymentMethods: PaymentMethodEnum[],
    webhookEvent: MyFatooraWebhookEvent,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (
        !paymentMethods.every((method) => this.isSupportedPaymentMethod(method))
      ) {
        throw new NotAcceptableException('Unsupported payment method');
      }

      const paymentData = webhookEvent.Data ?? webhookEvent;
      const paymentId = String(paymentData.InvoiceId);
      const transactionStatus = webhookEvent.TransactionStatus;

      if (!paymentId) {
        throw new BadRequestException('Missing invoice ID.');
      }

      const donation = await this.donationRepository.findOne({
        where: { paymentId },
        relations: ['project', 'campaign'],
      });

      if (!donation) {
        throw new NotFoundException(
          `Donation not found for payment ID: ${paymentId}`,
        );
      }

      const hasBeenFinalized = [
        DonationStatusEnum.COMPLETED,
        DonationStatusEnum.FAILED,
      ].includes(donation.status);

      if (hasBeenFinalized) {
        await queryRunner.rollbackTransaction();
        return { received: true, message: 'Donation already processed' };
      }

      if (!paymentMethods.includes(donation.paymentMethod)) {
        throw new NotAcceptableException('Donation payment method mismatch');
      }

      const isSuccess =
        paymentData.InvoiceStatus === 4 || transactionStatus === 'SUCCESS';
      const isFailure =
        paymentData.InvoiceStatus === 1 || transactionStatus === 'FAILED';

      if (!isSuccess && !isFailure) {
        await queryRunner.rollbackTransaction();
        return { received: true, message: 'Unhandled payment status' };
      }

      donation.status = isSuccess
        ? DonationStatusEnum.COMPLETED
        : DonationStatusEnum.FAILED;

      if (isSuccess) {
        donation.paidAt = new Date();
        const target = donation.project ?? donation.campaign;
        if (target) {
          target.currentAmount += Number(donation.amount);
          target.donationCount++;
          await queryRunner.manager.save(target);
        }
      }

      await queryRunner.manager.save(donation);
      await queryRunner.commitTransaction();
      return { success: true };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  public async findAll(): Promise<Donation[]> {
    return this.donationRepository.find({
      relations: ['donor', 'project', 'campaign'],
      order: { createdAt: 'DESC' },
    });
  }

  public async findOne(donationId: string): Promise<Donation> {
    const donation = await this.donationRepository.findOne({
      where: { id: donationId },
      relations: ['donor', 'project', 'campaign'],
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
    const deletionResult = await this.donationRepository.delete(donationId);
    if (deletionResult.affected === 0) {
      throw new NotFoundException(`Donation #${donationId} not found`);
    }
  }
}
