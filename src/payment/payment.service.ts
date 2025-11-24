/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * Payment Service Manager
 *
 * This service manages multiple payment providers and provides a unified interface
 * for payment operations. It follows the Strategy Pattern to allow easy addition
 * of new payment providers without modifying existing code.
 *
 * Features:
 * - Supports multiple providers (MyFatoorah, Stripe, PayMob, etc.)
 * - Automatically selects the active provider
 * - Can be easily extended for e-commerce, marketplaces, etc.
 * - DRY principle: no code duplication
 * - Simple and flexible design
 * - Performance optimized
 * - Memory optimized: Connection pooling, resource cleanup
 * - Health checks: Built-in health check for all providers
 *
 * ## Provider Management
 *
 * The PaymentService manages multiple payment providers and allows you to:
 * - Register/unregister providers at runtime
 * - Switch between providers dynamically
 * - Use a specific provider for a payment
 * - Check provider health status
 * - Replace providers without restarting the application
 *
 * ## Usage Examples
 *
 * ### Basic Usage
 * ```typescript
 * // Create payment with active provider (default: MyFatoorah)
 * const result = await paymentService.createPayment({
 *   amount: 100,
 *   currency: 'KWD',
 *   referenceId: 'order-123',
 *   customerEmail: 'customer@example.com',
 * });
 *
 * // Use specific provider
 * const result = await paymentService.createPayment(payload, 'stripe');
 *
 * // Get available payment methods
 * const methods = await paymentService.getAvailablePaymentMethods(100, 'KWD');
 * ```
 *
 * ### Provider Management
 * ```typescript
 * // Register a new provider at runtime
 * const customProvider = new CustomPaymentProvider(config);
 * paymentService.registerProvider('custom', customProvider);
 *
 * // Switch active provider
 * paymentService.setActiveProvider('stripe');
 *
 * // Get all registered providers
 * const providers = paymentService.getRegisteredProviders();
 * // Returns: ['myfatoorah', 'stripe', 'paymob']
 *
 * // Check provider health
 * const health = await paymentService.healthCheck('myfatoorah');
 * ```
 *
 * ### Using Multiple Providers
 * ```typescript
 * // Try MyFatoorah first, fallback to Stripe
 * try {
 *   const result = await paymentService.createPayment(payload, 'myfatoorah');
 * } catch (error) {
 *   const result = await paymentService.createPayment(payload, 'stripe');
 * }
 * ```
 *
 * ## Provider Registration
 *
 * Providers can be registered in three ways:
 *
 * 1. **Automatic Registration** (via constructor injection):
 *    - Providers are automatically registered if injected in constructor
 *    - Only registered if properly configured (isConfigured() returns true)
 *
 * 2. **Manual Registration** (via registerProvider):
 *    - Register providers manually using registerProvider()
 *    - Useful for dynamic provider registration
 *
 * 3. **Runtime Registration** (via registerProviderWithConfig):
 *    - Register providers with runtime configuration
 *    - Allows replacing providers without restarting
 *
 * ## Provider Selection
 *
 * The service uses an "active provider" for operations when no provider is specified:
 * - Default: MyFatoorah (if configured)
 * - Can be changed via setActiveProvider()
 * - Can be set via environment variable: PAYMENT_PROVIDER=stripe
 * - Falls back to first registered provider if default is not available
 *
 * ## Memory Management
 *
 * The service is optimized for memory:
 * - Maximum 10 providers can be registered (MAX_PROVIDERS)
 * - Automatic resource cleanup on module destroy
 * - Connection pooling for HTTP requests (handled by providers)
 *
 * @see {@link IPaymentProvider} for provider interface
 * @see {@link PaymentResult} for payment result structure
 * @see {@link PaymentStatusResult} for payment status structure
 */
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  IPaymentProvider,
  PaymentProviderType,
  PaymentStatusResult,
  AvailablePaymentMethodsResponse,
  PaymentWebhookEvent,
  ProviderHealthCheckResult,
} from './common/interfaces/payment-provider.interface';
import {
  PaymentPayload,
  PaymentResult,
} from './common/interfaces/payment-service.interface';
import { MyFatooraService } from './providers/myfatoora.provider';
import { PayMobService } from './providers/paymob.provider';
import { StripeService } from './providers/stripe.provider';

/**
 * Payment Service Manager
 *
 * This service is completely independent and can be moved to any project.
 * It has no dependencies on specific business logic (donations, orders, etc.)
 *
 * To use in another project:
 * 1. Copy the payment module files
 * 2. Register your payment providers
 * 3. Use PaymentService.createPayment() with your referenceId (orderId, subscriptionId, etc.)
 */
@Injectable()
export class PaymentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentService.name);
  private readonly providers: Map<PaymentProviderType, IPaymentProvider> =
    new Map();
  private activeProvider: IPaymentProvider | null = null;
  private readonly defaultProvider: PaymentProviderType = 'myfatoorah';

  // Memory optimization: Track provider count to prevent unbounded growth
  private static readonly MAX_PROVIDERS = 10; // Maximum number of providers to prevent memory leaks

  constructor(
    // Optional: Inject providers you want to auto-register
    // If not provided, you can register them manually via registerProvider()
    private readonly myFatooraService?: MyFatooraService,
    private readonly payMobService?: PayMobService, // PayMob provider (optional)
    private readonly stripeService?: StripeService, // Stripe provider (optional)
  ) {}

  /**
   * Initialize providers on module init
   * This is optional - you can also register providers manually
   * Providers are completely optional - no environment variables required
   */
  onModuleInit() {
    // Auto-register MyFatoorah if provided and configured
    // Provider will be skipped if not configured (no error thrown)
    if (this.myFatooraService) {
      this.registerProvider('myfatoorah', this.myFatooraService);
    }

    // Auto-register PayMob if provided and configured
    // PayMob is available but not used by default
    // Provider will be skipped if not configured (no error thrown)
    if (this.payMobService) {
      this.registerProvider('paymob', this.payMobService);
    }

    // Auto-register Stripe if provided and configured
    // Stripe is available but not used by default
    // Provider will be skipped if not configured (no error thrown)
    if (this.stripeService) {
      this.registerProvider('stripe', this.stripeService);
    }

    // Set active provider (can be configured via environment variable)
    // If no providers registered, service will work but will throw error when used
    const defaultProvider = this.getDefaultProvider();
    if (this.providers.has(defaultProvider)) {
      this.setActiveProvider(defaultProvider);
      this.logger.log(
        `Payment Service initialized with active provider: ${this.getActiveProviderName()}`,
      );
      this.logger.log(
        `Registered providers: ${this.getRegisteredProviders().join(', ')}`,
      );
    } else {
      this.logger.warn(
        'No payment providers registered. Register providers manually or configure environment variables.',
      );
      this.logger.warn(
        'You can register providers at runtime using: paymentService.registerProviderWithConfig(type, provider)',
      );
    }
  }

  /**
   * Register a payment provider
   *
   * Registers a payment provider with the service. The provider will be available
   * for use in payment operations. Only configured providers are registered by default.
   *
   * @param type Provider type identifier (e.g., 'myfatoorah', 'stripe', 'paymob')
   * @param provider Provider implementation that implements IPaymentProvider
   * @param skipConfigCheck If true, register provider even if not configured (useful for dynamic providers)
   *
   * @example
   * ```typescript
   * // Register a configured provider
   * const myFatooraService = new MyFatooraService(config);
   * paymentService.registerProvider('myfatoorah', myFatooraService);
   *
   * // Register provider without config check (for runtime configuration)
   * paymentService.registerProvider('custom', customProvider, true);
   * ```
   *
   * @remarks
   * - Providers are automatically registered if injected in constructor (onModuleInit)
   * - Maximum 10 providers can be registered (MAX_PROVIDERS)
   * - If provider is not configured and skipConfigCheck is false, it will be skipped
   * - If maximum providers reached, a warning is logged and registration is skipped
   *
   * @see {@link registerProviderWithConfig} for registering providers with runtime configuration
   * @see {@link unregisterProvider} for removing providers
   */
  registerProvider(
    type: PaymentProviderType,
    provider: IPaymentProvider,
    skipConfigCheck = false,
  ): void {
    // Memory optimization: Prevent unbounded provider growth
    if (
      this.providers.size >= PaymentService.MAX_PROVIDERS &&
      !this.providers.has(type)
    ) {
      this.logger.warn(
        `Maximum number of providers (${PaymentService.MAX_PROVIDERS}) reached. Cannot register ${type}.`,
      );
      return;
    }

    // Allow registration without config check for dynamic providers
    // This enables providers to be registered with runtime configuration
    if (!skipConfigCheck && !provider.isConfigured()) {
      this.logger.warn(
        `Payment provider ${type} is not properly configured and will be skipped`,
      );
      return;
    }

    this.providers.set(type, provider);
    this.logger.log(
      `Registered payment provider: ${type} (${provider.providerName})`,
    );
  }

  /**
   * Register a provider with runtime configuration
   *
   * Registers a provider that is already configured. This method is useful for:
   * - Replacing an existing provider with a new one at runtime
   * - Adding providers dynamically based on user configuration
   * - Switching between provider configurations without restarting
   *
   * @param type Provider type identifier (e.g., 'myfatoorah', 'stripe', 'paymob')
   * @param provider Provider implementation (must be already configured)
   *
   * @example
   * ```typescript
   * // Replace MyFatoorah with a new configuration
   * const newMyFatooraService = new MyFatooraService(newConfig);
   * paymentService.registerProviderWithConfig('myfatoorah', newMyFatooraService);
   *
   * // Add a new provider at runtime
   * const stripeService = new StripeService(stripeConfig);
   * paymentService.registerProviderWithConfig('stripe', stripeService);
   * ```
   *
   * @remarks
   * - Provider is registered without config check (skipConfigCheck = true)
   * - If this is the only provider or it's the default, it's automatically set as active
   * - If a provider with the same type already exists, it will be replaced
   *
   * @see {@link registerProvider} for standard provider registration
   * @see {@link setActiveProvider} for setting the active provider
   */
  registerProviderWithConfig(
    type: PaymentProviderType,
    provider: IPaymentProvider,
  ): void {
    // Register provider without config check since it's already configured
    this.registerProvider(type, provider, true);

    // If this is the only provider or it's the default, set it as active
    if (this.providers.size === 1 || type === this.defaultProvider) {
      this.setActiveProvider(type);
    }
  }

  /**
   * Unregister a payment provider
   *
   * Removes a provider from the service. If the removed provider was the active provider,
   * a new active provider is automatically selected from the remaining providers.
   *
   * @param type Provider type identifier (e.g., 'myfatoorah', 'stripe', 'paymob')
   *
   * @example
   * ```typescript
   * // Remove a provider
   * paymentService.unregisterProvider('stripe');
   *
   * // Check if provider was removed
   * const providers = paymentService.getRegisteredProviders();
   * // Returns: ['myfatoorah', 'paymob'] (stripe removed)
   * ```
   *
   * @remarks
   * - If the removed provider was active, the first remaining provider becomes active
   * - If no providers remain after removal, activeProvider is set to null
   * - Removing a non-existent provider has no effect (no error thrown)
   *
   * @see {@link registerProvider} for adding providers
   */
  unregisterProvider(type: PaymentProviderType): void {
    if (this.providers.has(type)) {
      this.providers.delete(type);
      this.logger.log(`Unregistered payment provider: ${type}`);

      // If the active provider was removed, set a new active provider
      if (
        this.activeProvider &&
        this.getProviderName(this.activeProvider) === type
      ) {
        const remainingProviders = Array.from(this.providers.keys());
        if (remainingProviders.length > 0) {
          this.setActiveProvider(remainingProviders[0]);
        } else {
          this.activeProvider = null;
          this.logger.warn('No payment providers remaining');
        }
      }
    }
  }

  /**
   * Get provider name from provider instance
   */
  private getProviderName(provider: IPaymentProvider): string {
    return provider.providerName;
  }

  /**
   * Get default provider based on configuration
   * Can be overridden via environment variable: PAYMENT_PROVIDER=myfatoorah|stripe|paymob
   */
  private getDefaultProvider(): PaymentProviderType {
    const envProvider = process.env.PAYMENT_PROVIDER as PaymentProviderType;

    if (envProvider && this.providers.has(envProvider)) {
      return envProvider;
    }

    // Return first registered provider, or default
    const registeredProviders = Array.from(this.providers.keys());
    if (registeredProviders.length > 0) {
      return registeredProviders[0];
    }

    return this.defaultProvider;
  }

  /**
   * Set active payment provider
   *
   * Sets the active provider that will be used for payment operations when no provider
   * is explicitly specified. The active provider must be registered and configured.
   *
   * @param type Provider type identifier (e.g., 'myfatoorah', 'stripe', 'paymob')
   *
   * @throws {InternalServerErrorException} If provider is not registered or not configured
   *
   * @example
   * ```typescript
   * // Set Stripe as active provider
   * paymentService.setActiveProvider('stripe');
   *
   * // Now all payments without provider specification will use Stripe
   * const result = await paymentService.createPayment(payload);
   * // Uses Stripe (active provider)
   * ```
   *
   * @remarks
   * - The active provider is used when no provider is specified in payment operations
   * - Default active provider is set automatically in onModuleInit()
   * - Can be overridden via environment variable: PAYMENT_PROVIDER=stripe
   * - Changing active provider does not affect ongoing payments
   *
   * @see {@link getActiveProvider} for getting the current active provider
   * @see {@link getActiveProviderName} for getting the active provider name
   */
  setActiveProvider(type: PaymentProviderType): void {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new InternalServerErrorException(
        `Payment provider '${type}' is not registered or not configured`,
      );
    }

    this.activeProvider = provider;
    this.logger.log(`Active payment provider set to: ${type}`);
  }

  /**
   * Get active payment provider
   *
   * Returns the currently active payment provider instance. The active provider is used
   * for payment operations when no provider is explicitly specified.
   *
   * @returns The active payment provider instance
   *
   * @throws {InternalServerErrorException} If no active provider is configured
   *
   * @example
   * ```typescript
   * // Get active provider
   * const activeProvider = paymentService.getActiveProvider();
   * console.log(activeProvider.providerName); // 'myfatoorah'
   *
   * // Use active provider directly
   * const result = await activeProvider.createPayment(payload);
   * ```
   *
   * @remarks
   * - Use this method when you need direct access to the provider instance
   * - For most use cases, use createPayment() without provider parameter
   * - Active provider is set automatically in onModuleInit() or via setActiveProvider()
   *
   * @see {@link getActiveProviderName} for getting just the provider name
   * @see {@link setActiveProvider} for changing the active provider
   */
  getActiveProvider(): IPaymentProvider {
    if (!this.activeProvider) {
      throw new InternalServerErrorException(
        'No active payment provider configured',
      );
    }
    return this.activeProvider;
  }

  /**
   * Get active provider name
   *
   * Returns the name of the currently active payment provider. This is a safe method
   * that returns 'none' if no active provider is configured (does not throw).
   *
   * @returns The active provider name (e.g., 'myfatoorah', 'stripe', 'paymob') or 'none'
   *
   * @example
   * ```typescript
   * // Get active provider name
   * const providerName = paymentService.getActiveProviderName();
   * console.log(providerName); // 'myfatoorah'
   *
   * // Use in logging
   * this.logger.log(`Using provider: ${paymentService.getActiveProviderName()}`);
   * ```
   *
   * @remarks
   * - This method never throws (returns 'none' if no active provider)
   * - Use this for logging or display purposes
   * - For provider instance access, use getActiveProvider()
   *
   * @see {@link getActiveProvider} for getting the provider instance
   */
  getActiveProviderName(): string {
    try {
      return this.getActiveProvider().providerName;
    } catch {
      return 'none';
    }
  }

  /**
   * Get provider by type
   *
   * Returns a specific provider instance by its type identifier. Use this method
   * when you need to use a specific provider or access provider-specific features.
   *
   * @param type Provider type identifier (e.g., 'myfatoorah', 'stripe', 'paymob')
   * @returns The provider instance
   *
   * @throws {BadRequestException} If provider is not registered
   *
   * @example
   * ```typescript
   * // Get specific provider
   * const stripeProvider = paymentService.getProvider('stripe');
   *
   * // Use provider directly
   * const result = await stripeProvider.createPayment(payload);
   *
   * // Or use via PaymentService with provider parameter
   * const result = await paymentService.createPayment(payload, 'stripe');
   * ```
   *
   * @remarks
   * - Use this method when you need provider-specific features
   * - For most use cases, use createPayment() with provider parameter instead
   * - Provider must be registered before use
   *
   * @see {@link getRegisteredProviders} for getting all registered provider types
   * @see {@link createPayment} for creating payments with specific provider
   */
  getProvider(type: PaymentProviderType): IPaymentProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new BadRequestException(
        `Payment provider '${type}' is not available`,
      );
    }
    return provider;
  }

  /**
   * Get all registered providers
   *
   * Returns an array of all registered provider type identifiers. Use this method
   * to check which providers are available or to iterate over all providers.
   *
   * @returns Array of registered provider type identifiers
   *
   * @example
   * ```typescript
   * // Get all registered providers
   * const providers = paymentService.getRegisteredProviders();
   * console.log(providers); // ['myfatoorah', 'stripe', 'paymob']
   *
   * // Iterate over providers
   * for (const providerType of paymentService.getRegisteredProviders()) {
   *   const health = await paymentService.healthCheck(providerType);
   *   console.log(`${providerType}: ${health.status}`);
   * }
   *
   * // Check if provider is registered
   * const isRegistered = paymentService.getRegisteredProviders().includes('stripe');
   * ```
   *
   * @remarks
   * - Returns only registered and configured providers
   * - Provider order may vary (use setActiveProvider() to control default)
   * - Empty array if no providers are registered
   *
   * @see {@link getProvider} for getting a specific provider instance
   * @see {@link registerProvider} for registering providers
   */
  getRegisteredProviders(): PaymentProviderType[] {
    return Array.from(this.providers.keys());
  }

  // ==================== Unified Payment Operations ====================

  /**
   * Create payment using active provider or specified provider
   *
   * Creates a payment using the specified provider or the active provider if none is specified.
   * This is the main method for initiating payments in the system.
   *
   * @param payload Payment payload containing amount, currency, customer info, etc.
   * @param providerType Optional provider type (e.g., 'myfatoorah', 'stripe', 'paymob').
   *                     If not specified, uses the active provider.
   *
   * @returns Payment result containing transaction ID, payment URL, and status
   *
   * @throws {BadRequestException} If provider is not available or payload is invalid
   * @throws {InternalServerErrorException} If no active provider and none specified
   *
   * @example
   * ```typescript
   * // Create payment with active provider
   * const result = await paymentService.createPayment({
   *   amount: 100,
   *   currency: 'KWD',
   *   referenceId: 'order-123',
   *   description: 'Payment for order #123',
   *   customerEmail: 'customer@example.com',
   *   customerName: 'John Doe',
   *   paymentMethodId: 1, // Optional: KNET for MyFatoorah
   * });
   *
   * // Use specific provider
   * const result = await paymentService.createPayment(
   *   {
   *     amount: 100,
   *     currency: 'USD',
   *     referenceId: 'order-123',
   *     customerEmail: 'customer@example.com',
   *   },
   *   'stripe', // Use Stripe instead of active provider
   * );
   *
   * // Redirect user to payment URL
   * return { redirectUrl: result.url };
   * ```
   *
   * @remarks
   * - If providerType is not specified, uses the active provider
   * - Payment URL in result should be used to redirect the user
   * - Payment status is initially 'pending' until webhook or status check
   * - referenceId should be a generic identifier (orderId, donationId, etc.)
   *
   * @see {@link getPaymentStatus} for checking payment status
   * @see {@link setActiveProvider} for changing the active provider
   */
  async createPayment(
    payload: PaymentPayload & { paymentMethodId?: string | number },
    providerType?: PaymentProviderType,
  ): Promise<PaymentResult> {
    const provider = providerType
      ? this.getProvider(providerType)
      : this.getActiveProvider();

    this.logger.debug(
      `Creating payment with provider: ${provider.providerName}`,
    );

    return provider.createPayment(payload);
  }

  /**
   * Get payment status using active provider or specified provider
   *
   * Retrieves the current status of a payment transaction. This method also checks
   * if the payment has expired and marks it as 'failed' if expired and still 'pending'.
   *
   * @param transactionId Transaction/Invoice ID from the payment provider
   * @param providerType Optional provider type. If not specified, uses the active provider
   *
   * @returns Payment status result with outcome, transaction ID, amount, currency, etc.
   *
   * @throws {BadRequestException} If transactionId is invalid or provider is not available
   * @throws {InternalServerErrorException} If no active provider and none specified
   *
   * @example
   * ```typescript
   * // Get payment status with active provider
   * const status = await paymentService.getPaymentStatus('invoice-id-123');
   *
   * if (status.outcome === 'paid') {
   *   // Process successful payment
   *   await orderService.markAsPaid(status.transactionId);
   * } else if (status.outcome === 'failed') {
   *   // Handle failed payment
   *   await orderService.markAsFailed(status.transactionId);
   * }
   *
   * // Get status with specific provider
   * const status = await paymentService.getPaymentStatus(
   *   'payment-intent-id',
   *   'stripe',
   * );
   * ```
   *
   * @remarks
   * - Automatically checks payment expiry and marks expired payments as 'failed'
   * - Expiry check is provider-agnostic (works with all providers)
   * - Use this method to verify payment status after webhook or callback
   * - Status outcome can be: 'paid', 'failed', or 'pending'
   *
   * @see {@link createPayment} for creating payments
   * @see {@link handleWebhook} for handling webhook events
   */
  async getPaymentStatus(
    transactionId: string,
    providerType?: PaymentProviderType,
  ): Promise<PaymentStatusResult> {
    const provider = providerType
      ? this.getProvider(providerType)
      : this.getActiveProvider();

    const result = await provider.getPaymentStatus(transactionId);

    // Check if payment has expired (provider-agnostic check)
    // This is done at PaymentService level, not provider level
    // to keep providers independent and reusable
    if (result.raw && this.isPaymentExpired(result.raw)) {
      // If payment has expired and is still pending, mark as failed
      if (result.outcome === 'pending') {
        result.outcome = 'failed';
        this.logger.warn(
          `Payment ${transactionId} has expired. Marking as failed.`,
        );
      }
    }

    return result;
  }

  /**
   * Check if payment has expired based on raw response data
   * This is a provider-agnostic check that looks for common expiry fields
   * @param rawData Raw response data from payment provider
   * @returns true if payment has expired
   */
  private isPaymentExpired(rawData: any): boolean {
    if (!rawData) return false;

    // Check for common expiry date fields across providers
    const expiryDateStr =
      rawData.ExpireDate || // MyFatoorah
      rawData.expiryDate || // Generic
      rawData.expiresAt || // Generic
      rawData.expires_at; // Generic

    if (!expiryDateStr) return false;

    try {
      const expiryDate = new Date(expiryDateStr);
      const now = new Date();

      // If expiry date has passed, payment is expired
      return expiryDate < now;
    } catch {
      // If date parsing fails, assume not expired
      return false;
    }
  }

  /**
   * Get available payment methods using active provider or specified provider
   *
   * Retrieves a list of available payment methods for a given amount and currency.
   * This includes payment method details, service charges, and availability.
   *
   * @param invoiceAmount Invoice amount to calculate service charges
   * @param currencyIso Currency ISO code (e.g., 'KWD', 'USD', 'EGP')
   * @param providerType Optional provider type. If not specified, uses the active provider
   *
   * @returns Available payment methods with service charges and metadata
   *
   * @throws {BadRequestException} If amount is invalid or provider is not available
   * @throws {InternalServerErrorException} If no active provider and none specified
   *
   * @example
   * ```typescript
   * // Get available payment methods with active provider
   * const methods = await paymentService.getAvailablePaymentMethods(100, 'KWD');
   *
   * // Display methods to user
   * methods.paymentMethods.forEach(method => {
   *   console.log(`${method.nameEn}: ${method.totalAmount} ${method.currency}`);
   * });
   *
   * // Get methods from specific provider
   * const methods = await paymentService.getAvailablePaymentMethods(
   *   100,
   *   'USD',
   *   'stripe',
   * );
   * ```
   *
   * @remarks
   * - Service charges are calculated by the provider based on amount
   * - Payment methods may vary by provider and currency
   * - Some methods may have min/max limits
   * - Direct payment methods (Apple Pay, Google Pay) are marked with isDirectPayment: true
   *
   * @see {@link createPayment} for creating payments with specific payment method
   */
  async getAvailablePaymentMethods(
    invoiceAmount: number,
    currencyIso: string,
    providerType?: PaymentProviderType,
  ): Promise<AvailablePaymentMethodsResponse> {
    const provider = providerType
      ? this.getProvider(providerType)
      : this.getActiveProvider();

    return provider.getAvailablePaymentMethods(invoiceAmount, currencyIso);
  }

  /**
   * Handle webhook from provider
   *
   * Processes a webhook event from a payment provider. This method validates the webhook
   * signature (if supported) and normalizes the webhook data into a standard format.
   *
   * @param webhookData Raw webhook data from the payment provider
   * @param providerType Provider type (required to identify which provider sent the webhook)
   *
   * @returns Normalized webhook event with transaction ID, status, amount, etc.
   *
   * @throws {BadRequestException} If webhook signature is invalid or provider is not available
   *
   * @example
   * ```typescript
   * // In webhook controller
   * @Post('webhooks/myfatoorah')
   * async handleMyFatoorahWebhook(@Body() data: any) {
   *   const event = await paymentService.handleWebhook(data, 'myfatoorah');
   *
   *   if (event.status === 'paid') {
   *     // Process successful payment
   *     await orderService.markAsPaid(event.transactionId);
   *   }
   *
   *   return { received: true };
   * }
   * ```
   *
   * @remarks
   * - Webhook signature validation is performed if provider supports it
   * - Webhook data is normalized to a standard format (PaymentWebhookEvent)
   * - Provider type must be specified to identify the correct provider
   * - Always verify webhook signature in production
   *
   * @see {@link getPaymentStatus} for verifying payment status after webhook
   */
  async handleWebhook(
    webhookData: any,
    providerType: PaymentProviderType,
  ): Promise<PaymentWebhookEvent> {
    const provider = this.getProvider(providerType);

    // Validate webhook if method exists
    if (provider.validateWebhook) {
      const isValid = await provider.validateWebhook(webhookData);
      if (!isValid) {
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    return provider.handleWebhook(webhookData);
  }

  /**
   * Check health status of a specific provider or all providers
   *
   * Performs a health check on payment providers to verify they are operational.
   * This method tests connectivity, authentication, and API availability.
   *
   * @param providerType Optional provider type to check. If not provided, checks all registered providers
   *
   * @returns Health check result(s) with status, response time, and error details
   *
   * @example
   * ```typescript
   * // Check health of all providers
   * const health = await paymentService.healthCheck();
   * // Returns: Array of health check results
   *
   * health.forEach(result => {
   *   console.log(`${result.provider}: ${result.status}`);
   *   if (result.status === 'unhealthy') {
   *     console.error(`Error: ${result.error}`);
   *   }
   * });
   *
   * // Check health of specific provider
   * const health = await paymentService.healthCheck('myfatoorah');
   * // Returns: Single health check result
   *
   * if (health.status === 'healthy') {
   *   console.log(`Provider is healthy (${health.responseTime}ms)`);
   * } else {
   *   console.error(`Provider is ${health.status}: ${health.message}`);
   * }
   * ```
   *
   * @remarks
   * - Health check performs a lightweight API call to test connectivity
   * - Status can be: 'healthy', 'unhealthy', or 'not_configured'
   * - Response time is included in the result (in milliseconds)
   * - If provider doesn't support healthCheck(), falls back to isConfigured() check
   * - Use this method to monitor provider availability
   *
   * @see {@link getRegisteredProviders} for getting all registered providers
   */
  async healthCheck(
    providerType?: PaymentProviderType,
  ): Promise<ProviderHealthCheckResult | ProviderHealthCheckResult[]> {
    // If specific provider requested
    if (providerType) {
      const provider = this.providers.get(providerType);
      if (!provider) {
        return {
          provider: providerType,
          status: 'not_configured',
          configured: false,
          message: `Provider '${providerType}' is not registered`,
          timestamp: new Date().toISOString(),
        };
      }

      // Check if provider has healthCheck method
      if (typeof provider.healthCheck === 'function') {
        return await provider.healthCheck();
      }

      // Fallback: check if configured
      return {
        provider: providerType,
        status: provider.isConfigured() ? 'healthy' : 'not_configured',
        configured: provider.isConfigured(),
        message: provider.isConfigured()
          ? 'Provider is configured but health check is not available'
          : 'Provider is not configured',
        timestamp: new Date().toISOString(),
      };
    }

    // Check all registered providers
    const results: ProviderHealthCheckResult[] = [];
    for (const [type, provider] of this.providers.entries()) {
      if (typeof provider.healthCheck === 'function') {
        try {
          const result = await provider.healthCheck();
          results.push(result);
        } catch (error) {
          results.push({
            provider: type,
            status: 'unhealthy',
            configured: provider.isConfigured(),
            message: 'Health check failed',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // Fallback: check if configured
        results.push({
          provider: type,
          status: provider.isConfigured() ? 'healthy' : 'not_configured',
          configured: provider.isConfigured(),
          message: provider.isConfigured()
            ? 'Provider is configured but health check is not available'
            : 'Provider is not configured',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Cleanup resources on module destroy
   * This helps prevent memory leaks by clearing provider references
   */
  onModuleDestroy() {
    // Clear all providers from Map to free memory
    this.providers.clear();
    this.activeProvider = null;
    this.logger.log('Payment Service resources cleaned up');
  }
}
