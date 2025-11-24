import {
  Controller,
  Get,
  Query,
  Param,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CurrencyService } from './common/services/currency.service';
import { PaymentService } from './payment.service';
import { ProviderHealthCheckResult } from './common/interfaces/payment-provider.interface';

/**
 * Controller for payment methods management
 * Provides endpoints to fetch available payment methods from any payment provider
 * (MyFatoorah, Stripe, PayMob, etc.)
 *
 * This controller is provider-agnostic and uses PaymentService to route requests
 * to the appropriate provider. This makes the system DRY and flexible.
 */
@Controller('payment-methods')
export class PaymentMethodsController {
  private readonly logger = new Logger(PaymentMethodsController.name);

  constructor(
    private readonly currencyService: CurrencyService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Get available payment methods from payment provider
   * This endpoint uses PaymentService to get real-time payment method availability
   * with service charges calculated based on the invoice amount
   *
   * Supports all payment providers (MyFatoorah, Stripe, PayMob, etc.)
   * Uses the active provider by default, or a specific provider if specified
   *
   * @param invoiceAmount - The invoice amount to calculate service charges
   * @param currencyIso - The currency ISO code (e.g., KWD, USD, EUR)
   * @param provider - Optional provider type (myfatoorah, stripe, paymob). If not specified, uses active provider
   * @returns List of available payment methods with metadata
   */
  @Get('available')
  async getAvailablePaymentMethods(
    @Query('invoiceAmount') invoiceAmount?: string,
    @Query('currencyIso') currencyIso?: string,
    @Query('provider') provider?: string,
  ) {
    try {
      // Default values if not provided
      const amount = invoiceAmount ? parseFloat(invoiceAmount) : 1.0;
      // Normalize currency but don't restrict - let provider handle currency validation
      const currency = currencyIso
        ? this.currencyService.normalizeCurrency(currencyIso)
        : 'KWD';

      // Validate amount only - currency validation is handled by the payment provider
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException(
          'invoiceAmount must be a positive number',
        );
      }

      // Use PaymentService to get available payment methods
      // This routes to the appropriate provider (MyFatoorah, Stripe, PayMob, etc.)
      const providerType = provider ? provider : undefined;
      const response = await this.paymentService.getAvailablePaymentMethods(
        amount,
        currency,
        providerType,
      );

      // Return response directly from PaymentService
      // PaymentService already handles provider-specific logic and fallback
      const activeProvider =
        provider || this.paymentService.getActiveProviderName();
      return {
        ...response,
        provider: response.fallback ? undefined : activeProvider,
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

      // For other errors, return a generic error response
      throw new BadRequestException(
        `Failed to fetch payment methods: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all supported payment methods from active provider
   * This endpoint returns payment methods from the active payment provider
   * Useful for UI dropdowns and payment method selection
   *
   * @param provider - Optional provider type. If not specified, uses active provider
   * @param currencyIso - Optional currency ISO code. Defaults to 'KWD'
   * @returns List of all supported payment methods with metadata
   */
  @Get('supported')
  async getAllSupportedPaymentMethods(
    @Query('provider') provider?: string,
    @Query('currencyIso') currencyIso?: string,
  ) {
    const currency = currencyIso || 'KWD';
    const amount = 1.0; // Default amount for lookup

    try {
      const providerType = provider ? provider : undefined;
      const response = await this.paymentService.getAvailablePaymentMethods(
        amount,
        currency,
        providerType,
      );

      return {
        success: true,
        paymentMethods: response.paymentMethods,
        count: response.paymentMethods.length,
        provider: provider || this.paymentService.getActiveProviderName(),
        currency,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch supported payment methods: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        success: false,
        paymentMethods: [],
        count: 0,
        message: `Failed to fetch payment methods: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get payment method details by ID
   * Supports all payment providers (MyFatoorah, Stripe, PayMob, etc.)
   *
   * @param id - Payment method ID (provider-specific)
   * @param currencyIso - Optional currency ISO code. Defaults to 'KWD'
   * @param provider - Optional provider type. If not specified, uses active provider
   * @returns Payment method information
   */
  @Get(':id')
  async getPaymentMethodById(
    @Param('id') id: string,
    @Query('currencyIso') currencyIso?: string,
    @Query('provider') provider?: string,
  ) {
    // Payment methods are provider-specific and dynamic
    // Get available payment methods from the specified or active provider
    const currency = currencyIso || 'KWD';
    const amount = 1.0; // Default amount for lookup

    try {
      const providerType = provider ? provider : undefined;
      const response = await this.paymentService.getAvailablePaymentMethods(
        amount,
        currency,
        providerType,
      );

      // Try to find method by ID (can be string or number)
      const method = response.paymentMethods.find(
        (m) => String(m.id) === String(id),
      );

      if (!method) {
        throw new BadRequestException(
          `Payment method with ID ${id} not found for currency ${currency} using provider ${provider || this.paymentService.getActiveProviderName()}`,
        );
      }

      return {
        success: true,
        paymentMethod: method,
        provider: provider || this.paymentService.getActiveProviderName(),
      };
    } catch (error) {
      // If provider fails, return error
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch payment method: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Health check endpoint for payment providers
   * Tests connection to payment providers to verify they are working
   *
   * @param provider Optional provider type to check. If not provided, checks all providers
   * @returns Health check results
   */
  @Get('health')
  async healthCheck(
    @Query('provider') provider?: string,
  ): Promise<ProviderHealthCheckResult | ProviderHealthCheckResult[]> {
    return await this.paymentService.healthCheck(provider as any);
  }
}
