import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Headers,
  HttpStatus,
  UsePipes,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { MyFatooraService } from './myfatoora.service';
import { MyFatooraWebhookData } from '../common/interfaces/myfatoora.interface';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
import { donationExistsPipe } from '../common/pipes/donationExists.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
// import { Roles } from '../common/decorators/roles.decorator';
// import { Role } from '../common/constants/roles.constant';

/**
 * Controller for MyFatoora payment gateway endpoints
 */
@Controller('myfatoora')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MyFatooraController {
  constructor(private readonly myFatooraService: MyFatooraService) {}

  /**
   * Webhook to receive status updates from MyFatoora
   * Verifies signature header if configured
   */
  @Post('webhook')
  async handleWebhook(
    @Body() payload: MyFatooraWebhookData,
    @Headers('x-myfatoorah-signature') signature?: string,
  ): Promise<{ status: number }> {
    await this.myFatooraService.handleWebhook(payload, signature);
    return { status: HttpStatus.OK };
  }

  /**
   * Manually retrieve payment status by invoice ID
   */
  @Get('status/:id')
  async getPaymentStatus(
    @Param('id') invoiceId: string,
  ): Promise<ReturnType<MyFatooraService['getPaymentStatus']>> {
    return this.myFatooraService.getPaymentStatus(invoiceId);
  }

  /**
   * Redirect endpoint after successful payment
   */
  @Get('success/:donationId')
  @UsePipes(ParseIntPipe, donationExistsPipe)
  handleSuccess(@Param('donationId') donationId: string): {
    donationId: string;
    code: number;
    message: string;
    DonationStatus: DonationStatusEnum;
  } {
    return {
      donationId,
      code: HttpStatus.OK,
      message: 'Payment successful',
      DonationStatus: DonationStatusEnum.COMPLETED,
    };
  }

  /**
   * Redirect endpoint after cancelled payment
   */
  @Get('cancel/:donationId')
  @UsePipes(ParseIntPipe, donationExistsPipe)
  async handleCancel(@Param('donationId') donationId: string): Promise<{
    donationId: string;
    code: number;
    message: string;
    DonationStatus: DonationStatusEnum;
  }> {
    await this.myFatooraService.handlePaymentFailed(donationId);
    return {
      donationId,
      code: HttpStatus.EXPECTATION_FAILED,
      message: 'Payment canceled',
      DonationStatus: DonationStatusEnum.FAILED,
    };
  }
}
