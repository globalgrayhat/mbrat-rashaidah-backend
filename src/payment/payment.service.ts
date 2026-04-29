import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  PaymentPayload,
  PaymentResult,
} from './common/interfaces/payment-service.interface';
import {
  PaymentStatusResult,
  AvailablePaymentMethodsResponse,
  ProviderHealthCheckResult,
  PaymentProviderType,
} from './common/interfaces/payment-provider.interface';
import { MyFatooraService } from './providers/myfatoora.provider';

@Injectable()
export class PaymentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentService.name);
  private myFatooraService: MyFatooraService | null = null;

  constructor(myFatooraService?: MyFatooraService) {
    if (myFatooraService?.isConfigured()) {
      this.myFatooraService = myFatooraService;
    }
  }

  onModuleInit() {
    if (this.myFatooraService) {
      this.logger.log('Payment Service initialized with MyFatoorah');
    } else {
      this.logger.warn('No payment provider configured');
    }
  }

  onModuleDestroy() {
    this.myFatooraService = null;
  }

  getActiveProviderName(): string {
    return this.myFatooraService?.providerName || 'none';
  }

  getRegisteredProviders(): PaymentProviderType[] {
    return this.myFatooraService ? ['myfatoorah'] : [];
  }

  async createPayment(
    payload: PaymentPayload,
    _providerType?: PaymentProviderType,
  ): Promise<PaymentResult> {
    if (!this.myFatooraService) {
      throw new InternalServerErrorException(
        'No active payment provider configured',
      );
    }
    return this.myFatooraService.createPayment(payload);
  }

  async getPaymentStatus(
    transactionId: string,
    keyType?: string,
    _providerType?: PaymentProviderType,
  ): Promise<PaymentStatusResult> {
    if (!this.myFatooraService) {
      throw new InternalServerErrorException(
        'No active payment provider configured',
      );
    }
    return this.myFatooraService.getPaymentStatus(transactionId, keyType);
  }

  async getAvailablePaymentMethods(
    invoiceAmount: number,
    currencyIso: string,
    _providerType?: PaymentProviderType,
  ): Promise<AvailablePaymentMethodsResponse> {
    if (!this.myFatooraService) {
      throw new InternalServerErrorException(
        'No active payment provider configured',
      );
    }
    return this.myFatooraService.getAvailablePaymentMethods(
      invoiceAmount,
      currencyIso,
    );
  }

  async healthCheck(
    _providerType?: PaymentProviderType,
  ): Promise<ProviderHealthCheckResult> {
    if (!this.myFatooraService) {
      return {
        provider: 'myfatoorah',
        status: 'not_configured',
        configured: false,
        timestamp: new Date().toISOString(),
      };
    }
    const start = Date.now();
    try {
      await this.myFatooraService.healthCheck();
      return {
        provider: 'myfatoorah',
        status: 'healthy',
        configured: true,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        provider: 'myfatoorah',
        status: 'unhealthy',
        configured: true,
        error: String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  async handleWebhook(body: any): Promise<{ received: boolean }> {
    if (!this.myFatooraService) {
      throw new InternalServerErrorException(
        'No active payment provider configured',
      );
    }
    await this.myFatooraService.handleWebhook(body);
    return { received: true };
  }
}
