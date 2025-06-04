import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { DonationsService } from './donations.service';
import { createDonationDto } from './dto/create-donation.dto';
import { campaignExistsPipe } from '../common/pipes/campaignExists.pipe';
import { donationExistsPipe } from '../common/pipes/donationExists.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import { PaymentMethodEnum } from '../common/constants/payment.constant';
import {
  StripeEvent,
  MyFatooraEvent,
} from '../common/interfaces/payment.interface';

@Controller('donations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Get('project/:projectId')
  async findByProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.donationsService.findByProject(projectId);
  }

  @Post('project/:projectId')
  async create(
    @Param('projectId', ParseUUIDPipe, campaignExistsPipe) projectId: string,
    @Body() createDonationDto: createDonationDto,
  ) {
    const donation = await this.donationsService.create({
      ...createDonationDto,
      projectId,
    });

    return donation;
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe, donationExistsPipe) id: string) {
    return this.donationsService.findOne(id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe, donationExistsPipe) id: string) {
    return this.donationsService.remove(id);
  }

  @Post('webhook/stripe')
  async handleStripeWebhook(
    @Body() event: StripeEvent,
    @Body('type') type: string,
  ) {
    try {
      if (type === 'checkout.session.completed') {
        await this.donationsService.handlePaymentWebhook(
          PaymentMethodEnum.STRIPE,
          event,
        );
      } else if (type === 'payment_intent.payment_failed') {
        await this.donationsService.handlePaymentWebhook(
          PaymentMethodEnum.STRIPE,
          event,
        );
      }
      return { received: true };
    } catch (err) {
      if (err instanceof Error) {
        throw new BadRequestException(
          `Failed to process webhook: ${err.message}`,
        );
      }
      throw new BadRequestException('Failed to process webhook');
    }
  }

  @Post('webhook/myfatoora')
  async handleMyFatooraWebhook(@Body() event: MyFatooraEvent) {
    try {
      await this.donationsService.handlePaymentWebhook(
        PaymentMethodEnum.MYFATOORA,
        event,
      );
      return { received: true };
    } catch (err) {
      if (err instanceof Error) {
        throw new BadRequestException(
          `Failed to process webhook: ${err.message}`,
        );
      }
      throw new BadRequestException('Failed to process webhook');
    }
  }
}
