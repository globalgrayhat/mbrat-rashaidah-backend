/**
 * Invoice Controller
 *
 * Provides a unified, public endpoint for retrieving invoice details.
 * The frontend should ONLY call this endpoint — never MyFatoorah directly.
 *
 * Endpoints:
 *   GET /api/invoice/:invoiceId        — by MyFatoorah InvoiceId
 *   GET /api/invoice/payment/:paymentId — by MyFatoorah PaymentId
 */
import {
  Controller,
  Get,
  Param,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { Invoice } from './common/interfaces/invoice.interface';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/invoice')
export class InvoiceController {
  private readonly logger = new Logger(InvoiceController.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * GET /api/invoice/:invoiceId
   *
   * Retrieve full invoice details by MyFatoorah InvoiceId.
   * Returns a clean, normalised Invoice object with:
   *  - Invoice ID, Payment ID, status
   *  - Total amount and currency
   *  - Itemised breakdown (name, type, amount)
   *  - Customer info (name, email, mobile)
   *  - Date and time
   *
   * @param invoiceId — MyFatoorah InvoiceId (numeric string)
   */
  @Public()
  @Get(':invoiceId')
  async getInvoice(@Param('invoiceId') invoiceId: string): Promise<Invoice> {
    this.logger.debug(`GET /api/invoice/${invoiceId}`);

    try {
      return await this.invoiceService.getInvoiceByInvoiceId(invoiceId);
    } catch (error) {
      // Re-throw known NestJS exceptions as-is
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Wrap unexpected errors
      this.logger.error(
        `Failed to retrieve invoice ${invoiceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new BadRequestException(
        `Failed to retrieve invoice: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * GET /api/invoice/payment/:paymentId
   *
   * Retrieve full invoice details by MyFatoorah PaymentId.
   * Resolves the InvoiceId internally and returns the same clean Invoice object.
   *
   * @param paymentId — MyFatoorah PaymentId
   */
  @Public()
  @Get('payment/:paymentId')
  async getInvoiceByPaymentId(
    @Param('paymentId') paymentId: string,
  ): Promise<Invoice> {
    this.logger.debug(`GET /api/invoice/payment/${paymentId}`);

    try {
      return await this.invoiceService.getInvoiceByPaymentId(paymentId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to retrieve invoice by PaymentId ${paymentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new BadRequestException(
        `Failed to retrieve invoice: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
