import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Inject,
  NotFoundException,
} from '@nestjs/common';
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

/**
 * Service for integrating with MyFatoora payment gateway
 * Based on MyFatoora Gateway Integration docs:
 * https://docs.myfatoorah.com/docs/gateway-integration
 */
@Injectable()
export class MyFatooraService {
  private readonly axiosInstance: AxiosInstance;
  private readonly logger = new Logger(MyFatooraService.name);

  constructor(
    @Inject('MYFATOORA_CONFIG')
    private readonly config: MyFatooraConfig,
    private readonly dataSource: DataSource,
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {
    // Initialize Axios client with base URL and API key
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
  }

  /**
   * Create a payment invoice via MyFatoora SendPayment API
   * https://docs.myfatoorah.com/docs/gateway-integration#sendpayment
   */
  async createPayment(input: PaymentCreateInput): Promise<PaymentResult> {
    const payload: MyFatooraSendPaymentPayload = {
      CustomerName: input.customerName || 'Anonymous Donor',
      NotificationOption: 'Lnk',
      InvoiceValue: input.amount,
      DisplayCurrencyIso: input.currency,
      CustomerMobile: input.customerPhone || '',
      CustomerEmail: input.customerEmail || '',
      CallBackUrl: `${this.config.successUrl}/${input.donationId}`,
      ErrorUrl: `${this.config.errorUrl}/${input.donationId}`,
      Language: 'en',
      CustomerReference: input.donationId,
      SourceInfo: 'Web',
    };

    try {
      const response =
        await this.axiosInstance.post<MyFatooraSendPaymentResponse>(
          '/v2/SendPayment',
          payload,
        );
      const data = response.data;

      if (!data.IsSuccess || !data.Data) {
        throw new BadRequestException(
          `MyFatoora SendPayment failed: ${data.Message}`,
        );
      }

      return {
        id: data.Data.InvoiceId.toString(),
        url: data.Data.PaymentURL,
        status: 'pending',
        amount: input.amount,
        currency: input.currency,
        paymentMethod: 'MYFATOORA',
        metadata: {
          invoiceId: data.Data.InvoiceId,
          customerReference: data.Data.CustomerReference,
        },
      };
    } catch (err) {
      this.logger.error('CreatePayment error', err);
      throw new InternalServerErrorException(
        `Unable to create MyFatoora payment: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle MyFatoora webhook callback
   * Expects MyFatooraWebhookData payload
   */
  async handleWebhook(
    payload: MyFatooraWebhookData,
    signature?: string,
  ): Promise<void> {
    // Optionally verify signature if configured
    if (this.config.webhookSecret && signature) {
      const valid = this.verifySignature(JSON.stringify(payload), signature);
      if (!valid) {
        throw new BadRequestException('Invalid MyFatoora webhook signature');
      }
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const donation = await this.donationRepo.findOne({
        where: { paymentId: payload.InvoiceId.toString() },
        relations: ['project'],
      });
      if (!donation) throw new NotFoundException('Donation not found');

      // Update status based on InvoiceStatus
      donation.status = this.mapStatus(payload.InvoiceStatus);
      if (donation.status === DonationStatusEnum.COMPLETED)
        donation.paidAt = new Date();
      await qr.manager.save(donation);

      // Update project if paid
      if (
        donation.project &&
        donation.status === DonationStatusEnum.COMPLETED
      ) {
        donation.project.currentAmount += donation.amount;
        donation.project.donationCount += 1;
        await qr.manager.save(donation.project);
      }

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error('Webhook processing failed', err);
      throw new BadRequestException(
        `Webhook processing error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      await qr.release();
    }
  }

  /**
   * Retrieve payment status via getPaymentStatus API
   * https://docs.myfatoorah.com/docs/gateway-integration#getpaymentstatus
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentResult> {
    const payload: MyFatooraPaymentStatusPayload = {
      Key: parseInt(paymentId, 10),
      KeyType: 'InvoiceId',
    };
    try {
      const resp =
        await this.axiosInstance.post<MyFatooraPaymentStatusResponse>(
          '/v2/getpaymentstatus',
          payload,
        );
      const data = resp.data;
      if (!data.IsSuccess || !data.Data) {
        throw new BadRequestException(
          `getPaymentStatus failed: ${data.Message}`,
        );
      }
      return {
        id: paymentId,
        status: this.mapToPaymentStatus(
          this.mapStatus(data.Data.InvoiceStatus),
        ),
        amount: data.Data.InvoiceValue,
        currency: data.Data.PaidCurrency,
        paymentMethod: 'MYFATOORA',
        metadata: {
          invoiceStatus: data.Data.InvoiceStatus,
          paymentDate: data.Data.PaymentDate,
        },
      };
    } catch (err) {
      this.logger.error('getPaymentStatus error', err);
      throw new InternalServerErrorException(
        `Unable to fetch MyFatoora status: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  /** Map MyFatoora status to internal DonationStatusEnum */
  private mapStatus(status: string): DonationStatusEnum {
    switch (status) {
      case 'Paid':
        return DonationStatusEnum.COMPLETED;
      case 'Pending':
        return DonationStatusEnum.PENDING;
      case 'Failed':
      case 'Expired':
        return DonationStatusEnum.FAILED;
      default:
        return DonationStatusEnum.FAILED;
    }
  }

  /** Map DonationStatusEnum to PaymentStatus */
  private mapToPaymentStatus(status: DonationStatusEnum): PaymentStatus {
    switch (status) {
      case DonationStatusEnum.COMPLETED:
        return 'completed';
      case DonationStatusEnum.PENDING:
        return 'pending';
      case DonationStatusEnum.FAILED:
        return 'failed';
      default:
        return 'failed';
    }
  }

  /** Verify webhook signature using HMAC SHA256 */
  private verifySignature(body: string, sig: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(body, 'utf8')
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(sig));
  }

  /**
   * Mark donation as failed manually
   */
  async handlePaymentFailed(donationId: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const donation = await this.donationRepo.findOne({
        where: { id: donationId },
      });
      if (!donation) throw new NotFoundException('Donation not found');
      donation.status = DonationStatusEnum.FAILED;
      await qr.manager.save(donation);
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw new BadRequestException(
        `Failed to mark donation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      await qr.release();
    }
  }
}
