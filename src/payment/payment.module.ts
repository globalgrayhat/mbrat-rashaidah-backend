/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Module, forwardRef, Optional } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyFatooraService } from './providers/myfatoora.provider';
import { PayMobService } from './providers/paymob.provider';
import { StripeService } from './providers/stripe.provider';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/config.service';
import { CurrencyService } from './common/services/currency.service';
import { NotificationService } from '../common/services/notification.service';
import { TransactionLoggerService } from '../common/services/transaction-logger.service';
import { PaymentMethodsController } from './payment-methods.controller';
import { WebhookController } from './webhook.controller';
import { PaymentReconciliationController } from './common/cron/payment-reconciliation.cron.controller';
import { DonationsModule } from '../donations/donations.module';
import { PaymentReconciliationService } from './common/cron/payment-reconciliation.cron';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * Payment Module
 *
 * This module is portable and can be used in any project.
 * Payment providers can work with or without AppConfigService.
 *
 * Supported Providers:
 * - MyFatoorah: Middle East payment gateway (default, actively used)
 * - PayMob: Egypt and Middle East payment gateway (optional)
 * - Stripe: Global payment gateway (optional)
 *
 * All providers are optional. Configure via environment variables to enable:
 * - MyFatoorah: MYFATOORAH_API_KEY
 * - PayMob: PAYMOB_API_KEY
 * - Stripe: STRIPE_SECRET_KEY
 *
 * Providers are automatically registered if configured.
 *
 * To remove a provider:
 * 1. Remove it from providers array below
 * 2. Remove it from PaymentService constructor injection
 * 3. Remove environment variables
 *
 * To add a new provider:
 * 1. Create provider service implementing IPaymentProvider
 * 2. Add it to providers array
 * 3. Add it to PaymentService constructor (optional auto-registration)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    ScheduleModule.forRoot(), // Enable cron jobs
    AppConfigModule, // Optional: Providers can work without it
    forwardRef(() => DonationsModule), // Use forwardRef to handle circular dependency
  ],
  controllers: [
    PaymentMethodsController,
    WebhookController,
    PaymentReconciliationController,
  ],
  providers: [
    // ========== Payment Providers ==========
    // All providers are completely optional - remove any you don't need
    // No environment variables required - providers work without them
    // You can register providers at runtime with custom configuration

    // MyFatoorah provider (optional)
    // Remove this if you don't need MyFatoorah
    // Can be configured via environment variables OR passed directly to constructor
    // Provider will be skipped if not configured (no error thrown)
    {
      provide: MyFatooraService,
      useFactory: (config?: AppConfigService) => {
        // Provider can work with or without AppConfigService
        // If no config provided, it reads from environment variables
        // If no env vars, provider will be marked as not configured (skipped)
        try {
          return new MyFatooraService(config || undefined);
        } catch {
          // If provider fails to initialize (e.g., missing required config),
          // return undefined - it will be skipped during registration
          return undefined;
        }
      },
      inject: [AppConfigService], // AppConfigService is optional - can be undefined
    },

    // PayMob provider (optional)
    // Remove this if you don't need PayMob
    // Can be configured via environment variables OR passed directly to constructor
    // Provider will be skipped if not configured (no error thrown)
    {
      provide: PayMobService,
      useFactory: (config?: AppConfigService) => {
        // Provider can work with or without AppConfigService
        // AppConfigService implements IPayMobConfigAdapter interface
        try {
          return new PayMobService((config as any) || undefined);
        } catch {
          // If provider fails to initialize, return undefined
          return undefined;
        }
      },
      inject: [AppConfigService], // AppConfigService is optional - can be undefined
    },

    // Stripe provider (optional)
    // Remove this if you don't need Stripe
    // Can be configured via environment variables OR passed directly to constructor
    // Provider will be skipped if not configured (no error thrown)
    {
      provide: StripeService,
      useFactory: (config?: AppConfigService) => {
        // Provider can work with or without AppConfigService
        // AppConfigService implements IStripeConfigAdapter interface
        try {
          return new StripeService((config as any) || undefined);
        } catch {
          // If provider fails to initialize, return undefined
          return undefined;
        }
      },
      inject: [AppConfigService], // AppConfigService is optional - can be undefined
    },

    // ========== Core Services ==========
    // Payment service manager (manages all providers)
    PaymentService,
    AppConfigService, // Optional: Providers can work without it
    CurrencyService,
    NotificationService,
    TransactionLoggerService,

    // ========== Reconciliation Service ==========
    // Service for automatic payment reconciliation via cron job
    PaymentReconciliationService,
  ],
  exports: [
    // Export PaymentService as the main interface
    PaymentService,

    // Export individual providers for direct use if needed
    // Remove exports you don't need
    MyFatooraService,
    PayMobService,
    StripeService,

    // Export shared services
    CurrencyService,
    NotificationService,
    TransactionLoggerService,

    // Export reconciliation service
    PaymentReconciliationService,
  ],
})
export class PaymentModule {}
