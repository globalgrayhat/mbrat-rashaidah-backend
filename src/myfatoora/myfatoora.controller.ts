import { Controller, Post, Body, Get, Param, Headers, HttpStatus, UsePipes, ParseIntPipe, UseGuards } from '@nestjs/common';
import { MyFatooraService } from './myfatoora.service';
import { MyFatooraWebhookData } from '../common/interfaces/myfatoora.interface';
import { DonationStatusEnum } from '../common/constants/donationStatus.constant';
import { donationExistsPipe } from '../common/pipes/donationExists.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';

@Controller('myfatoora')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MyFatooraController {
  constructor(private readonly myFatooraService: MyFatooraService) {}

  @Post('webhook')
  async handleWebhook(
    @Body() webhookData: MyFatooraWebhookData,
    @Headers('x-myfatoorah-signature') signature: string,
  ): Promise<void> {
    // This endpoint will be called by MyFatoora when payment status changes
    return this.myFatooraService.handleWebhook(webhookData);
  }

  @Get('payment/:id')
  async getPaymentStatus(@Param('id') paymentId: string) {
    // This endpoint can be used to check payment status manually
    return this.myFatooraService.getPaymentStatus(paymentId);
  }

  @Get('success/:donationId')
  @UsePipes(donationExistsPipe)
  handleSuccess(@Param('donationId', ParseIntPipe) donationId: string) {
    return {
      donationId,
      code: HttpStatus.OK,
      message: 'successful payment',
      DonationStatus: DonationStatusEnum.COMPLETED,
    };
  }

  @Get('cancel/:donationId')
  @UsePipes(donationExistsPipe)
  async handleFailure(@Param('donationId', ParseIntPipe) donationId: string) {
    await this.myFatooraService.handlePaymentFailed(donationId);

    return {
      donationId,
      code: HttpStatus.EXPECTATION_FAILED,
      message: 'Canceled Payment',
      DonationStatus: DonationStatusEnum.FAILED,
    };
  }
}
