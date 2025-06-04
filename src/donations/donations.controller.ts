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
import { CreateDonationDto } from './dto/create-donation.dto';
import { campaignExistsPipe } from '../common/pipes/campaignExists.pipe';
import { donationExistsPipe } from '../common/pipes/donationExists.pipe';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { AuthRolesEnum } from '../common/enums';
import { Role } from '../common/decorators/role.decorator';
import { PaymentMethodEnum } from './entities/donation.entity';
import {
  StripeEvent,
  MyFatooraEvent,
} from '../common/interfaces/payment.interface';

@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Get('project/:projectId')
  async findByProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.donationsService.findByProject(projectId);
  }

  @Post('project/:projectId')
  async create(
    @Param('projectId', ParseUUIDPipe, campaignExistsPipe) projectId: string,
    @Body() createDonationDto: CreateDonationDto,
  ) {
    const donation = await this.donationsService.create({
      ...createDonationDto,
      projectId,
    });

    return donation;
  }

  @Get(':id')
  @UseGuards(JwtGuard, RoleGuard)
  @Role(AuthRolesEnum.ADMIN)
  findOne(@Param('id', ParseUUIDPipe, donationExistsPipe) id: string) {
    return this.donationsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RoleGuard)
  @Role(AuthRolesEnum.ADMIN)
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
