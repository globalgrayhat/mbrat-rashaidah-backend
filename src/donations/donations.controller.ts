/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

@Controller('donations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DonationsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly donorsService: DonorsService,
  ) {}

  @Post()
  async createDonation(@Body() createDonationDto: CreateDonationDto) {
    return this.donationsService.create(createDonationDto);
  }

  // --- Payment status (by invoiceId in the path) ----------------------------
  // Example: GET /donations/payment-status/5977301
  @Get('payment-status/:invoiceId')
  async getAndReconcileByInvoiceId(@Param('invoiceId') invoiceId: string) {
    // Uses DonationsService.reconcilePaymentByInvoiceId
    return this.donationsService.reconcilePaymentByInvoiceId(invoiceId);
  }

  @Get('project/:projectId')
  async findByProject(
    @Param('projectId', ParseUUIDPipe, ProjectExistsPipe) projectId: string,
  ) {
    return this.donationsService.findByProject(projectId);
  }

  @Get('campaign/:campaignId')
  async findByCampaign(
    @Param('campaignId', ParseUUIDPipe, CampaignExistsPipe) campaignId: string,
  ) {
    return this.donationsService.findByCampaign(campaignId);
  }

  @Get('donor/:donorId')
  async findByDonor(
    @Param('donorId', ParseUUIDPipe, DonorExistsPipe) donorId: string,
  ) {
    return this.donationsService.findByDonor(donorId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe, DonationExistsPipe) id: string) {
    return this.donationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe, DonationExistsPipe) id: string,
    @Body() updateDonationDto: UpdateDonationDto,
  ) {
    return this.donationsService.update(id, updateDonationDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe, DonationExistsPipe) id: string) {
    return this.donationsService.remove(id);
  }

  // --- Donor Endpoints ------------------------------------------------------
  @Post('donors')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  createDonor(@Body() createDonorDto: CreateDonorDto) {
    return this.donorsService.create(createDonorDto);
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
    @Body() updateDonorDto: UpdateDonorDto,
  ) {
    return this.donorsService.update(id, updateDonorDto);
  }

  @Delete('donors/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  removeDonor(@Param('id', ParseUUIDPipe, DonorExistsPipe) id: string) {
    return this.donorsService.remove(id);
  }
}
