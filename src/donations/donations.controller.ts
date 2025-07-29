import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Patch,
  Query,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';

import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';

import { DonorsService } from '../donor/donor.service';
import { CreateDonorDto } from '../donor/dto/create-donor.dto';
import { UpdateDonorDto } from '../donor/dto/update-donor.dto';

import { ProjectExistsPipe } from '../common/pipes/projectExists.pipe';
import { CampaignExistsPipe } from '../common/pipes/campaignExists.pipe';
import { DonorExistsPipe } from '../common/pipes/donorExists.pipe';
import { DonationExistsPipe } from '../common/pipes/donationExists.pipe';

import { MyFatooraWebhookEvent } from '../common/interfaces/payment-service.interface';
import { PaymentMethodEnum } from '../common/constants/payment.constant';
import { Public } from '../common/decorators/public.decorator';

@Controller('donations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DonationsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly donorsService: DonorsService,
  ) {}

  @Post()
  createDonation(@Body() dto: CreateDonationDto) {
    return this.donationsService.create(dto);
  }

  @Get('project/:projectId')
  findByProject(
    @Param('projectId', ParseUUIDPipe, ProjectExistsPipe) projectId: string,
  ) {
    return this.donationsService.findByProject(projectId);
  }

  @Get('campaign/:campaignId')
  findByCampaign(
    @Param('campaignId', ParseUUIDPipe, CampaignExistsPipe) campaignId: string,
  ) {
    return this.donationsService.findByCampaign(campaignId);
  }

  @Get('donor/:donorId')
  findByDonor(
    @Param('donorId', ParseUUIDPipe, DonorExistsPipe) donorId: string,
  ) {
    return this.donationsService.findByDonor(donorId);
  }

  /** DRY: عبر Query ما فيه Pipes تتعارض */
  @Get('payment-status')
  getAndReconcile(
    @Query('key') key: string,
    @Query('type') type: 'InvoiceId' | 'PaymentId' = 'InvoiceId',
  ) {
    if (!key) throw new BadRequestException('Missing key');
    return this.donationsService.reconcilePayment(key, type);
  }

  /** Alias واضح للإنفويس (ParseIntPipe بدال ريجكس في المسار) */
  @Get('payment-status/invoice/:invoiceId')
  getAndReconcileByInvoiceId(
    @Param('invoiceId', new ParseIntPipe({ errorHttpStatusCode: 400 }))
    invoiceId: number,
  ) {
    return this.donationsService.reconcilePayment(
      String(invoiceId),
      'InvoiceId',
    );
  }

  /** Alias للـ PaymentId كما هو (سترنق) */
  @Get('payment-status/payment/:paymentId')
  getAndReconcileByPaymentId(@Param('paymentId') paymentId: string) {
    return this.donationsService.reconcilePayment(paymentId, 'PaymentId');
  }

  @Public()
  @Post('payment/webhook')
  myFatoorahWebhook(@Body() body: MyFatooraWebhookEvent) {
    const supported = [PaymentMethodEnum.KNET, PaymentMethodEnum.VISA];
    return this.donationsService.handlePaymentWebhook(supported, body);
  }

  @Post('donors')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  createDonor(@Body() dto: CreateDonorDto) {
    return this.donorsService.create(dto);
  }
  @Get('donors')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAllDonors() {
    return this.donorsService.findAll();
  }
  @Get('donors/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOneDonor(@Param('id', ParseUUIDPipe, DonorExistsPipe) id: string) {
    return this.donorsService.findOne(id);
  }
  @Patch('donors/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateDonor(
    @Param('id', ParseUUIDPipe, DonorExistsPipe) id: string,
    @Body() dto: UpdateDonorDto,
  ) {
    return this.donorsService.update(id, dto);
  }
  @Delete('donors/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  removeDonor(@Param('id', ParseUUIDPipe, DonorExistsPipe) id: string) {
    return this.donorsService.remove(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe, DonationExistsPipe) id: string) {
    return this.donationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe, DonationExistsPipe) id: string,
    @Body() dto: UpdateDonationDto,
  ) {
    return this.donationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe, DonationExistsPipe) id: string) {
    return this.donationsService.remove(id);
  }
}
