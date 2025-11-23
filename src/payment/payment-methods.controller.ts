/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Query,
  Param,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { MyFatooraService } from './myfatoora.service';
import { CurrencyService } from '../common/services/currency.service';
import {
  getPaymentMethodInfo,
  PAYMENT_METHOD_INFO,
} from '../common/constants/payment.constant';

/**
 * Controller for payment methods management
 * Provides endpoints to fetch available payment methods from MyFatoorah
 */
@Controller('payment-methods')
export class PaymentMethodsController {
  private readonly logger = new Logger(PaymentMethodsController.name);

  constructor(
    private readonly myFatooraService: MyFatooraService,
    private readonly currencyService: CurrencyService,
  ) {}

  /**
   * Get available payment methods from MyFatoorah
   * This endpoint calls InitiatePayment to get real-time payment method availability
   * with service charges calculated based on the invoice amount
   *
   * @param invoiceAmount - The invoice amount to calculate service charges
   * @param currencyIso - The currency ISO code (e.g., KWD, USD)
   * @returns List of available payment methods with metadata
   */
  @Get('available')
  async getAvailablePaymentMethods(
    @Query('invoiceAmount') invoiceAmount?: string,
    @Query('currencyIso') currencyIso?: string,
  ) {
    try {
      // Default values if not provided
      const amount = invoiceAmount ? parseFloat(invoiceAmount) : 1.0;
      const currency = currencyIso
        ? this.currencyService.normalizeCurrency(currencyIso)
        : 'KWD';

      // Validate inputs
      if (!this.currencyService.isValidCurrency(currency)) {
        throw new BadRequestException(
          `Invalid currency: ${currency}. Supported currencies: ${this.currencyService
            .getSupportedCurrencies()
            .map((c) => c.code)
            .join(', ')}`,
        );
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException(
          'invoiceAmount must be a positive number',
        );
      }

      // Call MyFatoorah InitiatePayment API
      let response: any;
      let useFallback = false;

      try {
        response = await this.myFatooraService.initiatePayment(
          amount,
          currency,
        );
      } catch (error) {
        // If MyFatoorah API fails (401, network error, etc.), use fallback
        if (
          error instanceof UnauthorizedException ||
          error instanceof BadRequestException
        ) {
          this.logger.warn(
            `MyFatoorah API unavailable, using fallback payment methods. Error: ${error instanceof Error ? error.message : String(error)}`,
          );
          useFallback = true;
        } else {
          // Re-throw unknown errors
          throw error;
        }
      }

      // If MyFatoorah API failed, return static payment methods as fallback
      if (useFallback) {
        const fallbackMethods = Object.values(PAYMENT_METHOD_INFO).map(
          (info) => ({
            id: info.id,
            code: info.code,
            nameEn: info.nameEn,
            nameAr: info.nameAr,
            isDirectPayment: info.isDirectPayment,
            serviceCharge: 0, // Unknown without API
            totalAmount: amount, // Use provided amount
            currency: currency,
            imageUrl: info.imageUrl,
            minLimit: undefined,
            maxLimit: undefined,
            note: 'Service charges not available. MyFatoorah API is not configured or unavailable.',
          }),
        );

        return {
          success: true,
          invoiceAmount: amount,
          currency,
          paymentMethods: fallbackMethods,
          timestamp: new Date().toISOString(),
          fallback: true,
          message:
            'Payment methods retrieved from static list. MyFatoorah API is not available. Please configure MYFATOORAH_API_KEY in your environment variables.',
        };
      }

      // Enrich payment methods with our metadata from MyFatoorah response
      const enrichedMethods = response.PaymentMethods.map((method: any) => {
        const localInfo = getPaymentMethodInfo(method.PaymentMethodId);
        return {
          id: method.PaymentMethodId,
          code: method.PaymentMethodCode,
          nameEn: method.PaymentMethodEn,
          nameAr: method.PaymentMethodAr,
          isDirectPayment: method.IsDirectPayment,
          serviceCharge: method.ServiceCharge,
          totalAmount: method.TotalAmount,
          currency: method.CurrencyIso,
          imageUrl: method.ImageUrl || localInfo?.imageUrl,
          minLimit: method.MinLimit,
          maxLimit: method.MaxLimit,
        };
      });

      return {
        success: true,
        invoiceAmount: amount,
        currency,
        paymentMethods: enrichedMethods,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch payment methods: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Re-throw validation errors (BadRequestException for invalid input)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // For other errors (including UnauthorizedException from MyFatoorah),
      // return fallback static payment methods instead of throwing error
      const fallbackMethods = Object.values(PAYMENT_METHOD_INFO).map(
        (info) => ({
          id: info.id,
          code: info.code,
          nameEn: info.nameEn,
          nameAr: info.nameAr,
          isDirectPayment: info.isDirectPayment,
          serviceCharge: 0,
          totalAmount: invoiceAmount ? parseFloat(invoiceAmount) : 1.0,
          currency: currencyIso || 'KWD',
          imageUrl: info.imageUrl,
          minLimit: undefined,
          maxLimit: undefined,
          note: 'Service charges not available. MyFatoorah API is not configured or unavailable.',
        }),
      );

      return {
        success: true,
        invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : 1.0,
        currency: currencyIso || 'KWD',
        paymentMethods: fallbackMethods,
        timestamp: new Date().toISOString(),
        fallback: true,
        message:
          'Payment methods retrieved from static list. MyFatoorah API is not available. Please configure MYFATOORAH_API_KEY in your environment variables.',
      };
    }
  }

  /**
   * Get all supported payment methods (static list)
   * This endpoint returns all payment methods we support, regardless of MyFatoorah availability
   * Useful for UI dropdowns and payment method selection
   *
   * @returns List of all supported payment methods with metadata
   */
  @Get('supported')
  getAllSupportedPaymentMethods() {
    const methods = Object.values(PAYMENT_METHOD_INFO).map((info) => ({
      id: info.id,
      code: info.code,
      nameEn: info.nameEn,
      nameAr: info.nameAr,
      isDirectPayment: info.isDirectPayment,
      imageUrl: info.imageUrl,
    }));

    return {
      success: true,
      paymentMethods: methods,
      count: methods.length,
    };
  }

  /**
   * Get payment method details by ID
   *
   * @param id - Payment method ID
   * @returns Payment method information
   */
  @Get(':id')
  getPaymentMethodById(@Param('id') id: string) {
    const methodId = parseInt(id, 10);
    if (!Number.isFinite(methodId)) {
      throw new BadRequestException('Invalid payment method ID');
    }

    const info = getPaymentMethodInfo(methodId);
    if (!info) {
      throw new BadRequestException(
        `Payment method with ID ${methodId} not found`,
      );
    }

    return {
      success: true,
      paymentMethod: {
        id: info.id,
        code: info.code,
        nameEn: info.nameEn,
        nameAr: info.nameAr,
        isDirectPayment: info.isDirectPayment,
        imageUrl: info.imageUrl,
      },
    };
  }
}
