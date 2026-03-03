/* eslint-disable @typescript-eslint/no-unused-vars */
import { Module, forwardRef, Optional } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyFatooraService } from './providers/myfatoora.provider';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
// External dependencies - make them optional for portability
// When migrating to another project, you can:
// 1. Remove these imports if not available
// 2. Replace with your project's equivalents
// 3. Create mock services if needed
// See MIGRATION_IMPORTS_FIX.md for detailed instructions

// Option 1: Keep if you have AppConfigModule in your project
// Option 2: Remove and providers will read from environment variables directly
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/config.service';

// Internal payment module services (required)
import { CurrencyService } from './common/services/currency.service';
import { PaymentMethodsController } from './payment-methods.controller';
import { WebhookController } from './webhook.controller';
import { PaymentReconciliationController } from './common/cron/payment-reconciliation.cron.controller';
import { PaymentReconciliationService } from './common/cron/payment-reconciliation.cron';
import { ScheduleModule } from '@nestjs/schedule';

// External services - optional (remove if not available in your project)
// Option 1: Keep if you have these services
// Option 2: Remove and create mock services (see MIGRATION_IMPORTS_FIX.md)
// Option 3: Replace with your project's equivalents
import { NotificationService } from '../common/services/notification.service';
import { TransactionLoggerService } from '../common/services/transaction-logger.service';

// DonationsModule - remove this when migrating to another project
// This is only needed for the current project's webhook integration
// You should create your own webhook handler in your new project
import { DonationsModule } from '../donations/donations.module';

/**
 * Payment Module
 *
 * This module is portable and can be used in any project.
 * Payment providers can work with or without AppConfigService.
 *
 * Supported Providers:
 * - MyFatoorah: Middle East payment gateway (default, actively used)
 * Unsupported providers (removed):
 * - PayMob: Egypt and Middle East payment gateway (optional)
 * - Stripe: Global payment gateway (optional)
 *
 * All providers are optional. Configure via environment variables to enable:
 * - MyFatoorah: MYFATOORAH_API_KEY
 * *
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
    // AppConfigModule - Optional: Remove if not available, providers will read from env vars
    AppConfigModule, // Remove this line when migrating if AppConfigModule doesn't exist
    // DonationsModule - Remove this when migrating to another project
    // You should create your own webhook handler instead
    forwardRef(() => DonationsModule), // Remove this line when migrating
  ],
  controllers: [
    PaymentMethodsController,
    // WebhookController - Optional: Remove if you want to create your own webhook handler
    // When migrating, you can remove this and create your own webhook controller
    // that handles your order/donation entities
    WebhookController, // Remove this line when migrating if you create your own webhook handler
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

    // Stripe and PayMob providers have been removed for simplicity.
    // To restore them, refer to initial implementation or visit documentation.

    // ========== Core Services ==========
    // Payment service manager (manages all providers)
    PaymentService,
    // AppConfigService - Optional: Remove if not available
    AppConfigService, // Remove this line when migrating if AppConfigService doesn't exist
    CurrencyService,
    // External services - Optional: Remove if not available or replace with mock services
    NotificationService, // Remove this line when migrating if NotificationService doesn't exist
    TransactionLoggerService, // Remove this line when migrating if TransactionLoggerService doesn't exist

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
    MyFatooraService,

    // Export shared services
    CurrencyService,
    // External services - Remove from exports if removed from providers
    NotificationService, // Remove this line when migrating if NotificationService doesn't exist
    TransactionLoggerService, // Remove this line when migrating if TransactionLoggerService doesn't exist

    // Export reconciliation service
    PaymentReconciliationService,
  ],
})
export class PaymentModule {}
