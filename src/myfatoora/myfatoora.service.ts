// [FIXED 2025-06-04] MyFatooraService – SendPayment Gateway Integration (doc‑accurate)

import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Donation } from '../donations/entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import {
  MyFatooraConfig,
  MyFatooraSendPaymentPayload,
  MyFatooraSendPaymentResponse,
  MyFatooraPaymentStatusPayload,
  MyFatooraPaymentStatusResponse,
  MyFatooraWebhookData,
} from '../common/interfaces/myfatoora.interface';
import {
  PaymentCreateInput,
  PaymentResult,
  PaymentStatus,
} from '../common/interfaces/payment-service.interface';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';

@Injectable()
export class MyFatooraService {
  private readonly axiosInstance: AxiosInstance;
  private readonly logger = new Logger(MyFatooraService.name);

  constructor(
    @Inject('MYFATOORAH_CONFIG')
    private readonly config: MyFatooraConfig,
    private readonly dataSource: DataSource,
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async createPayment(input: PaymentCreateInput): Promise<PaymentResult> {
    try {
      const payload: MyFatooraSendPaymentPayload = {
        CustomerName: input.customerName ?? 'Anonymous Donor',
        NotificationOption: 'Lnk',
        InvoiceValue: input.amount,
        DisplayCurrencyIso: input.currency,
        CustomerMobile: input.customerPhone ?? '00000000',
        CustomerEmail: input.customerEmail ?? 'anon@example.com',
        CallBackUrl: `${this.config.successUrl}/${input.donationId}`,
        ErrorUrl: `${this.config.errorUrl}/${input.donationId}`,
        Language: 'en',
        CustomerReference: input.donationId,
        SourceInfo: 'Web',
      };

      const response = await this.axiosInstance.post<MyFatooraSendPaymentResponse>(
        '/v2/SendPayment',
        payload,
      );

      if (!response.data.IsSuccess || !response.data.Data) {
        throw new BadRequestException(
          `MyFatoora payment creation failed: ${response.data.Message}`,
        );
      }

      return {
        id: response.data.Data.InvoiceId.toString(),
        url: response.data.Data.PaymentURL,
        status: 'pending',
        amount: input.amount,
        currency: input.currency,
        paymentMethod: 'MYFATOORA',
        metadata: {
          invoiceId: response.data.Data.InvoiceId,
          customerReference: response.data.Data.CustomerReference,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to create MyFatoora payment: ${error.message}`,
        );
      }
      throw new BadRequestException('Failed to create MyFatoora payment');
    }
  }

  async handleWebhook(payload: MyFatooraWebhookData): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const donation = await this.donationRepo.findOne({
        where: { paymentId: payload.InvoiceId.toString() },
        relations: ['project'],
      });

      if (!donation) {
        throw new BadRequestException('Donation not found');
      }

      // Update donation status based on MyFatoora status
      switch (payload.InvoiceStatus) {
        case 'Paid':
          donation.status = DonationStatusEnum.COMPLETED;
          donation.paidAt = new Date();
          break;
        case 'Pending':
          donation.status = DonationStatusEnum.PENDING;
          break;
        case 'Failed':
        case 'Expired':
          donation.status = DonationStatusEnum.FAILED;
          break;
      }

      await queryRunner.manager.save(donation);

      // Update project totals if payment succeeded
      if (payload.InvoiceStatus === 'Paid' && donation.project) {
        const project = donation.project;
        project.currentAmount = Number(project.currentAmount || 0) + Number(donation.amount);
        project.donationCount = (project.donationCount || 0) + 1;
        await queryRunner.manager.save(project);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        'Failed to process webhook: ' + (err instanceof Error ? err.message : 'Unknown error'),
      );
    } finally {
      await queryRunner.release();
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentResult> {
    try {
      const payload: MyFatooraPaymentStatusPayload = {
        Key: parseInt(paymentId, 10),
        KeyType: 'InvoiceId',
      };

      const response = await this.axiosInstance.post<MyFatooraPaymentStatusResponse>(
        '/v2/getpaymentstatus',
        payload,
      );

      if (!response.data.IsSuccess || !response.data.Data) {
        throw new BadRequestException(
          `Failed to get payment status: ${response.data.Message}`,
        );
      }

      return {
        id: paymentId,
        status: this.mapMyFatooraStatus(response.data.Data.InvoiceStatus),
        amount: response.data.Data.InvoiceValue,
        currency: response.data.Data.PaidCurrency,
        paymentMethod: 'MYFATOORA',
        metadata: {
          invoiceStatus: response.data.Data.InvoiceStatus,
          paymentDate: response.data.Data.PaymentDate,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to get payment status: ${error.message}`,
        );
      }
      throw new BadRequestException('Failed to get payment status');
    }
  }

  private mapMyFatooraStatus(status: string): PaymentStatus {
    switch (status) {
      case 'Paid':
        return 'completed';
      case 'Pending':
        return 'pending';
      case 'Failed':
      case 'Expired':
        return 'failed';
      default:
        return 'failed';
    }
  }

  private verifySignature(body: string, sig: string): boolean {
    if (!this.config.webhookSecret) return false;
    const hash = crypto.createHmac('sha256', this.config.webhookSecret).update(body, 'utf8').digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(sig));
  }

  async handlePaymentFailed(donationId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const donation = await this.donationRepo.findOne({
        where: { id: donationId },
        relations: ['project'],
      });

      if (!donation) {
        throw new NotFoundException(`Donation #${donationId} not found`);
      }

      // Update donation status to failed
      donation.status = DonationStatusEnum.FAILED;
      await queryRunner.manager.save(donation);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        'Failed to process payment failure: ' + (err instanceof Error ? err.message : 'Unknown error'),
      );
    } finally {
      await queryRunner.release();
    }
  }
}
