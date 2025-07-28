import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Patch,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/createCampaignDto';
import { UpdateCampaignDto } from './dto/UpdateCampaignDto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import { CampaignStatus } from '../common/constants/campaignStatus.constant';
import { CampaignExistsPipe } from '../common/pipes/campaignExists.pipe'; // Need to create this pipe
import { User } from '../user/entities/user.entity';

@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(
    @Body() createCampaignDto: CreateCampaignDto,
    @Request() req: { user: User },
  ) {
    const user: User = req.user;
    return this.campaignsService.create(createCampaignDto, {
      ...user,
      id: user.id,
    });
  }

  @Get()
  findAll() {
    return this.campaignsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe, CampaignExistsPipe) id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe, CampaignExistsPipe) id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe, CampaignExistsPipe) id: string) {
    return this.campaignsService.remove(id);
  }

  @Get('category/:categoryId')
  findByCategory(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.campaignsService.findByCategory(categoryId);
  }

  @Get('status/:status')
  findCampaignList(@Param('status') status: CampaignStatus) {
    return this.campaignsService.findCampaignList(status);
  }

  @Get('details/:campaignId')
  findCampaignDetails(@Param('campaignId', ParseUUIDPipe) campaignId: string) {
    return this.campaignsService.findCampaignDetails(campaignId);
  }

  @Get('stats/summary')
  getCampaignStats() {
    return this.campaignsService.getCampaignStats();
  }
}
