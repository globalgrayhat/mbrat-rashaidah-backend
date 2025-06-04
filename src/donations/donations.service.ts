import {
  Injectable,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { Donation } from './entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../user/entities/user.entity';
import { StripeService } from '../stripe/stripe.service';
import { MyFatooraService } from '../myfatoora/myfatoora.service';
import { PaymentResult } from '../common/interfaces/payment-service.interface';
import {
  StripeEvent,
  MyFatooraEvent,
} from '../common/interfaces/payment.interface';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
import { PaymentMethodEnum } from '../common/constants/payment.constant';

@Injectable()
export class DonationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly stripe: StripeService,
    private readonly myfatoora: MyFatooraService,
  ) {}

  // Create a donation and initiate payment
  async create(createDonationDto: createDonationDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate project exists and has active donations
      const project = await this.projectRepo.findOne({
        where: { id: createDonationDto.projectId },
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      if (!project.isDonationActive) {
        throw new NotAcceptableException(
          'Donations are not active for this project',
        );
      }

      // Validate donor exists if specified
      if (createDonationDto.donorId) {
        const donor = await this.userRepo.findOne({
          where: { id: createDonationDto.donorId },
        });
        if (!donor) {
          throw new NotFoundException('Donor not found');
        }
      }

      // Create donation with status pending
      const donation = this.donationRepo.create({
        ...createDonationDto,
        status: DonationStatusEnum.PENDING,
        paymentMethod: createDonationDto.paymentMethod as PaymentMethodEnum,
      });

      await queryRunner.manager.save(donation);

      // Initialize payment based on selected gateway
      let paymentResult: PaymentResult;

      if (donation.paymentMethod === PaymentMethodEnum.STRIPE) {
        paymentResult = await this.stripe.createPayment({
          amount: createDonationDto.amount,
          currency: createDonationDto.currency,
          donationId: donation.id,
          projectTitle: project.title,
        });
      } else if (donation.paymentMethod === PaymentMethodEnum.MYFATOORA) {
        paymentResult = await this.myfatoora.createPayment({
          amount: createDonationDto.amount,
          currency: createDonationDto.currency,
          donationId: donation.id,
          projectTitle: project.title,
        });
      } else {
        throw new NotAcceptableException('Invalid payment method');
      }

      // Update donation with payment info
      donation.paymentId = paymentResult.id;
      donation.paymentDetails = paymentResult;
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
      relations: ['donor', 'project'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const donation = await this.donationRepo.findOne({
      where: { id },
      relations: ['donor', 'project'],
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

  async findByDonor(donorId: string) {
    return this.donationRepo.find({
      where: { donorId },
      relations: ['project'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateDonationDto: UpdateDonationDto) {
    const donation = await this.findOne(id);
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
    event: StripeEvent | MyFatooraEvent,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let donation: Donation | null = null;
      let status: DonationStatusEnum;

      if (paymentMethod === PaymentMethodEnum.STRIPE) {
        const stripeEvent = event as StripeEvent;
        const session = stripeEvent.data.object;

        donation = await this.donationRepo.findOne({
          where: { paymentId: session.id },
          relations: ['project'],
        });

        status =
          session.payment_status === 'paid'
            ? DonationStatusEnum.COMPLETED
            : DonationStatusEnum.FAILED;
      } else if (paymentMethod === PaymentMethodEnum.MYFATOORA) {
        const myFatooraEvent = event as MyFatooraEvent;
        const payment = myFatooraEvent.body;

        donation = await this.donationRepo.findOne({
          where: { paymentId: payment.InvoiceId },
          relations: ['project'],
        });

        status =
          payment.TransactionStatus === 'SUCCESS'
            ? DonationStatusEnum.COMPLETED
            : DonationStatusEnum.FAILED;
      } else {
        throw new NotAcceptableException('Invalid payment method');
      }

      if (!donation) {
        throw new NotFoundException('Donation not found');
      }

      // Update donation status
      donation.status = status;
      donation.paidAt =
        status === DonationStatusEnum.COMPLETED ? new Date() : null;
      await queryRunner.manager.save(donation);

      if (status === DonationStatusEnum.COMPLETED && donation.project) {
        // Update project amount
        const project = donation.project;
        project.currentAmount =
          Number(project.currentAmount) + Number(donation.amount);
        project.donationCount += 1;
        await queryRunner.manager.save(project);
      }

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
