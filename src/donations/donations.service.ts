import {
  Injectable,
  NotAcceptableException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { Donation } from './entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import { Campaign } from '../campaigns/entities/campaign.entity'; // Import Campaign
import { Donor } from '../donor/entities/donor.entity'; // Import Donor
import { User } from '../user/entities/user.entity'; // Import User
import { Payment } from '../payment/entities/payment.entity';
import {
  PaymentResult,
  MyFatooraWebhookEvent,
} from '../common/interfaces/payment-service.interface'; // Updated interface import
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
import { PaymentMethodEnum } from '../common/constants/payment.constant';
import { MyFatooraService } from '../payment/myfatoora.service'; // Import MyFatooraService

@Injectable()
export class DonationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Campaign) // Inject Campaign Repository
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(Donor) // Inject Donor Repository
    private readonly donorRepo: Repository<Donor>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly myFatooraService: MyFatooraService, // Renamed for clarity
  ) {}

  // Create a donation and initiate payment
  async create(createDonationDto: CreateDonationDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let targetEntity: Project | Campaign | null = null;
      let targetType: 'project' | 'campaign';

      // 1. Validate Project or Campaign exists and is donation active
      if (createDonationDto.projectId) {
        targetEntity = await this.projectRepo.findOne({
          where: { id: createDonationDto.projectId },
        });
        if (!targetEntity) {
          throw new NotFoundException('Project not found');
        }
        if (!targetEntity.isDonationActive) {
          throw new NotAcceptableException(
            'Donations are not active for this project',
          );
        }
        targetType = 'project';
      } else if (createDonationDto.campaignId) {
        targetEntity = await this.campaignRepo.findOne({
          where: { id: createDonationDto.campaignId },
        });
        if (!targetEntity) {
          throw new NotFoundException('Campaign not found');
        }
        if (!targetEntity.isDonationActive) {
          throw new NotAcceptableException(
            'Donations are not active for this campaign',
          );
        }
        targetType = 'campaign';
      } else {
        // This case should ideally be caught by the DTO validation (IsValidDonationTarget)
        // but adding a fallback for robustness.
        throw new BadRequestException(
          'Donation must be linked to either a project or a campaign.',
        );
      }

      // 2. Handle Donor (anonymous or registered)
      let donor: Donor | null = null;
      if (createDonationDto.donorInfo) {
        const { userId, isAnonymous, fullName, email, phoneNumber } =
          createDonationDto.donorInfo;

        if (userId) {
          // Attempt to find existing donor linked to this user
          donor = await this.donorRepo.findOne({ where: { userId } });
          if (!donor) {
            const user = await this.userRepo.findOne({ where: { id: userId } });
            if (!user) {
              throw new NotFoundException('User for donor not found.');
            }
            // Create a new donor record linked to the user
            donor = this.donorRepo.create({
              userId,
              fullName: user.fullName || user.username, // Assuming user has fullName or username
              email: user.email,
              isAnonymous: isAnonymous ?? false, // Respect explicit anonymity for this donation
            });
            await queryRunner.manager.save(donor);
          } else {
            // Update existing donor's anonymity preference if provided
            if (isAnonymous !== undefined) {
              donor.isAnonymous = isAnonymous;
              await queryRunner.manager.save(donor);
            }
          }
        } else if (isAnonymous) {
          // Anonymous donation without a linked user.
          // Create a new donor record with a generated name if no fullName provided, or use provided email.
          donor = this.donorRepo.create({
            fullName: fullName || 'Anonymous Donor', // Use provided name or default
            email: email, // Optional email for anonymous receipt
            phoneNumber: phoneNumber,
            isAnonymous: true,
          });
          await queryRunner.manager.save(donor);
        } else {
          // Non-anonymous donor without userId, means they're providing details directly
          donor = this.donorRepo.create({
            fullName: fullName,
            email: email,
            phoneNumber: phoneNumber,
            isAnonymous: false,
          });
          await queryRunner.manager.save(donor);
        }
      }

      // 3. إنشاء سجل الدفع مع حالة "معلق"
      const payment = this.paymentRepo.create({
        amount: createDonationDto.amount,
        currency: createDonationDto.currency,
        paymentMethod: createDonationDto.paymentMethod,
        status: 'pending', // حالة بوابة الدفع الأولية
        transactionId: 'temp-' + Math.random().toString(36).substring(2, 15), // معرف مؤقت سيتم تحديثه لاحقًا
        rawResponse: {},
      });
      await queryRunner.manager.save(payment);

      // 3. Create donation with status pending
      const donation = this.donationRepo.create({
        amount: createDonationDto.amount,
        currency: createDonationDto.currency,
        paymentMethod: createDonationDto.paymentMethod,
        status: DonationStatusEnum.PENDING,
        donor: donor ?? undefined, // Link the donor entity
        projectId: targetType === 'project' ? targetEntity.id : undefined,
        campaignId: targetType === 'campaign' ? targetEntity.id : undefined,
        anonymousEmail:
          donor?.isAnonymous && donor.email ? donor.email : undefined, // Store anonymous email on donation if applicable
      });

      await queryRunner.manager.save(donation);

      // 4. Initialize payment based on selected gateway
      let paymentResult: PaymentResult;

      const paymentPayload = {
        amount: createDonationDto.amount,
        currency: createDonationDto.currency,
        donationId: donation.id,
        description: `Donation for ${targetEntity.title}`,
        customerName: donor?.fullName || 'Anonymous',
        customerEmail: donor?.email || createDonationDto.donorInfo?.email, // Prefer donor's email, fallback to DTO
      };

      if (
        donation.paymentMethod === PaymentMethodEnum.MYFATOORA ||
        donation.paymentMethod === PaymentMethodEnum.KNET // Assuming KNET is handled via MyFatoora
      ) {
        paymentResult =
          await this.myFatooraService.createPayment(paymentPayload);
      } else {
        throw new NotAcceptableException(
          'Invalid or unsupported payment method',
        );
      }

      // 5. Update donation with payment info
      donation.paymentId = paymentResult.id;
      donation.paymentDetails = paymentResult; // Store full payment gateway response
      await queryRunner.manager.save(donation);

      await queryRunner.commitTransaction();

      return {
        donationId: donation.id,
        paymentUrl: paymentResult.url,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    return this.donationRepo.find({
      relations: ['donor', 'project', 'campaign'], // Include campaign relation
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const donation = await this.donationRepo.findOne({
      where: { id },
      relations: ['donor', 'project', 'campaign'], // Include campaign relation
    });

    if (!donation) {
      throw new NotFoundException(`Donation #${id} not found`);
    }

    return donation;
  }

  async findByProject(projectId: string) {
    return this.donationRepo.find({
      where: { projectId },
      relations: ['donor'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByCampaign(campaignId: string) {
    // New method to find donations by campaign
    return this.donationRepo.find({
      where: { campaignId },
      relations: ['donor'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByDonor(donorId: string) {
    return this.donationRepo.find({
      where: { donorId },
      relations: ['project', 'campaign'], // Include campaign relation
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateDonationDto: UpdateDonationDto) {
    const donation = await this.findOne(id);
    // Ensure project/campaign ID updates are not attempted via this method
    if (
      updateDonationDto.projectId !== undefined ||
      updateDonationDto.campaignId !== undefined
    ) {
      throw new BadRequestException(
        'Project or Campaign cannot be changed after donation creation.',
      );
    }
    Object.assign(donation, updateDonationDto);
    return this.donationRepo.save(donation);
  }

  async remove(id: string) {
    const result = await this.donationRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Donation #${id} not found`);
    }
  }

  // Handle webhook callbacks from payment providers
  async handlePaymentWebhook(
    paymentMethod: PaymentMethodEnum,
    event: MyFatooraWebhookEvent,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let donation: Donation | null = null;
      let status: DonationStatusEnum;
      let paymentId: string;

      if (paymentMethod === PaymentMethodEnum.MYFATOORA) {
        // Use event.Data if exists, otherwise event itself
        const paymentData = event.Data ?? event;
        const transactionStatus = event.TransactionStatus; // root level

        paymentId = String(paymentData.InvoiceId);

        if (!paymentId) {
          throw new BadRequestException('Missing invoice ID.');
        }

        donation = await this.donationRepo.findOne({
          where: { paymentId },
          relations: ['project', 'campaign'],
        });

        if (
          paymentData.InvoiceStatus === 4 ||
          transactionStatus === 'SUCCESS'
        ) {
          status = DonationStatusEnum.COMPLETED;
        } else if (
          paymentData.InvoiceStatus === 1 ||
          transactionStatus === 'FAILED'
        ) {
          status = DonationStatusEnum.FAILED;
        } else {
          await queryRunner.rollbackTransaction();
          return { received: true, message: 'Unhandled MyFatoora status' };
        }
      } else {
        throw new NotAcceptableException(
          'Unsupported payment method for webhook.',
        );
      }

      if (!donation) {
        throw new NotFoundException(
          `Donation not found for payment ID: ${paymentId}`,
        );
      }

      if (
        [DonationStatusEnum.COMPLETED, DonationStatusEnum.FAILED].includes(
          donation.status,
        )
      ) {
        await queryRunner.rollbackTransaction();
        return { received: true, message: 'Donation already processed' };
      }

      donation.status = status;
      if (status === DonationStatusEnum.COMPLETED) {
        donation.paidAt = new Date();

        if (donation.project) {
          donation.project.currentAmount += Number(donation.amount);
          donation.project.donationCount++;
          await queryRunner.manager.save(donation.project);
        } else if (donation.campaign) {
          donation.campaign.currentAmount += Number(donation.amount);
          donation.campaign.donationCount++;
          await queryRunner.manager.save(donation.campaign);
        }
      }

      await queryRunner.manager.save(donation);
      await queryRunner.commitTransaction();

      return { success: true };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
