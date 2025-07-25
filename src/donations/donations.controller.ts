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
  Patch,
} from '@nestjs/common';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto'; // Import UpdateDonationDto
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import { PaymentMethodEnum } from '../common/constants/payment.constant';
import {
  MyFatooraWebhookEvent, // Renamed for clarity
} from '../common/interfaces/payment-service.interface';
import { DonorsService } from '../donor/donor.service'; // Import DonorsService
import { CreateDonorDto } from '../donor/dto/create-donor.dto';
import { UpdateDonorDto } from '../donor/dto/update-donor.dto';
import { ProjectExistsPipe } from '../common/pipes/projectExists.pipe'; // Need to create this pipe
import { CampaignExistsPipe } from '../common/pipes/campaignExists.pipe'; // Need to create this pipe
import { DonorExistsPipe } from '../common/pipes/donorExists.pipe'; // Need to create this pipe
import { DonationExistsPipe } from '../common/pipes/donationExists.pipe'; // Already existing

@Controller('donations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DonationsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly donorsService: DonorsService, // Inject DonorsService
  ) {}

  @Post()
  // No specific project/campaign ID in path, as it's in DTO.
  // We apply the custom validation pipe at the DTO level.
  async createDonation(@Body() createDonationDto: CreateDonationDto) {
    // The custom validator IsValidDonationTarget in CreateDonationDto ensures only one ID is set
    return this.donationsService.create(createDonationDto);
  }

  @Get('project/:projectId')
  async findByProject(
    @Param('projectId', ParseUUIDPipe, ProjectExistsPipe) projectId: string,
  ) {
    return this.donationsService.findByProject(projectId);
  }

  @Get('campaign/:campaignId') // New endpoint for campaign donations
  async findByCampaign(
    @Param('campaignId', ParseUUIDPipe, CampaignExistsPipe) campaignId: string,
  ) {
    return this.donationsService.findByCampaign(campaignId);
  }

  @Get('donor/:donorId') // New endpoint for donor's donations
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
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) // Only admins can update donation details (status, paymentId)
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

  // --- Donor Endpoints ---
  @Post('donors')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) // Or no role if donors can self-register/be created implicitly
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

  // --- Webhook Endpoints (no auth guards as they are external callbacks) ---

  @Post('webhook/myfatoora')
  async handleMyFatooraWebhook(@Body() event: MyFatooraWebhookEvent) {
    // MyFatoora webhook structure can vary. Check their documentation.
    // Assuming the event directly contains relevant payment info or nested under 'Data'
    try {
      await this.donationsService.handlePaymentWebhook(
        PaymentMethodEnum.MYFATOORA,
        event,
      );
      return { received: true };
    } catch (err) {
      if (err instanceof Error) {
        throw new BadRequestException(
          `Failed to process MyFatoora webhook: ${err.message}`,
        );
      }
      throw new BadRequestException('Failed to process MyFatoora webhook');
    }
  }
}
