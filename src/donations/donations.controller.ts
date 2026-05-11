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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import { ProjectExistsPipe } from '../common/pipes/projectExists.pipe';
import { CampaignExistsPipe } from '../common/pipes/campaignExists.pipe';
import { DonorExistsPipe } from '../common/pipes/donorExists.pipe';
import { DonationExistsPipe } from '../common/pipes/donationExists.pipe';
import { MyFatooraWebhookEvent } from '../payment/common/interfaces/payment-service.interface';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { ApiCollectionResponse } from '../common/pagination/decorators/api-collection-response.decorator';
import { Donation } from './entities/donation.entity';

@ApiTags('Donations')
@Controller('donations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @ApiOperation({ summary: 'List all donations with pagination' })
  @ApiCollectionResponse(Donation)
  @Public()
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.donationsService.list(query);
  }

  @ApiOperation({ summary: 'Reconcile payment status' })
  @Public()
  @Get('payment-status')
  getAndReconcile(
    @Query('key') key?: string,
    @Query('paymentId') paymentId?: string,
    @Query('Id') id?: string,
    @Query('type') type: 'InvoiceId' | 'PaymentId' = 'InvoiceId',
  ) {
    const finalKey = key || paymentId || id;
    if (!finalKey) {
      throw new BadRequestException('Missing key, paymentId, or Id');
    }
    const finalType = paymentId || id ? 'PaymentId' : type;
    return this.donationsService.reconcilePayment(finalKey, finalType);
  }

  @ApiOperation({ summary: 'Reconcile payment by invoice ID' })
  @Public()
  @Get('payment-status/invoice/:invoiceId')
  getAndReconcileByInvoiceId(@Param('invoiceId') invoiceId: string) {
    return this.donationsService.reconcilePayment(invoiceId, 'InvoiceId');
  }

  @ApiOperation({ summary: 'Reconcile payment by payment ID' })
  @Public()
  @Get('payment-status/payment/:paymentId')
  getAndReconcileByPaymentId(@Param('paymentId') paymentId: string) {
    return this.donationsService.reconcilePayment(paymentId, 'PaymentId');
  }

  @ApiOperation({ summary: 'Handle payment webhook' })
  @Public()
  @Post('payment/webhook')
  myFatoorahWebhook(@Body() body: MyFatooraWebhookEvent) {
    return this.donationsService.handlePaymentWebhook([], body);
  }

  @ApiOperation({ summary: 'Recover missed payments from MyFatoorah webhook logs' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('payment/recover-webhooks')
  recoverWebhooks(@Query('hours') hours?: number) {
    return this.donationsService.recoverMissedPayments(hours);
  }

  @ApiOperation({ summary: 'Find donation by payment ID' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('payment/:paymentId')
  findByPayment(@Param('paymentId') paymentId: string) {
    return this.donationsService.findByPayment(paymentId);
  }

  @ApiOperation({ summary: 'Find donations by project' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('project/:projectId')
  findByProject(
    @Param('projectId', ParseUUIDPipe, ProjectExistsPipe) projectId: string,
  ) {
    return this.donationsService.findByProject(projectId);
  }

  @ApiOperation({ summary: 'Find donations by campaign' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('campaign/:campaignId')
  findByCampaign(
    @Param('campaignId', ParseUUIDPipe, CampaignExistsPipe) campaignId: string,
  ) {
    return this.donationsService.findByCampaign(campaignId);
  }

  @ApiOperation({ summary: 'Find donations by donor' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('donor/:donorId')
  findByDonor(
    @Param('donorId', ParseUUIDPipe, DonorExistsPipe) donorId: string,
  ) {
    return this.donationsService.findByDonor(donorId);
  }

  @ApiOperation({ summary: 'Create a new donation' })
  @Public()
  @Post()
  createDonation(@Body() dto: CreateDonationDto) {
    return this.donationsService.create(dto);
  }

  @ApiOperation({ summary: 'Update an existing donation' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe, DonationExistsPipe) id: string,
    @Body() dto: UpdateDonationDto,
  ) {
    return this.donationsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a donation' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe, DonationExistsPipe) id: string) {
    return this.donationsService.remove(id);
  }

  @ApiOperation({ summary: 'Get donation by ID' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe, DonationExistsPipe) id: string) {
    return this.donationsService.findOne(id);
  }
}
