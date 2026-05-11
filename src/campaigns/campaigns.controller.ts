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
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/createCampaignDto';
import { UpdateCampaignDto } from './dto/UpdateCampaignDto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import { CampaignStatus } from '../common/constants/campaignStatus.constant';
import { CampaignExistsPipe } from '../common/pipes/campaignExists.pipe';
import { User } from '../user/entities/user.entity';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { ApiCollectionResponse } from '../common/pagination/decorators/api-collection-response.decorator';
import { Campaign } from './entities/campaign.entity';
import { ReorderPinnedDto } from '../common/pagination/dto/reorder-pinned.dto';

@ApiTags('Campaigns')
@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @ApiOperation({ summary: 'List all campaigns with pagination and filters' })
  @ApiCollectionResponse(Campaign)
  @Public()
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.campaignsService.list(query);
  }

  @ApiOperation({ summary: 'Get summary statistics for campaigns' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('stats/summary')
  getCampaignStats() {
    return this.campaignsService.getCampaignStats();
  }

  @ApiOperation({ summary: 'Reorder pinned campaigns' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch('pins/reorder')
  reorderPins(@Body() dto: ReorderPinnedDto) {
    return this.campaignsService.reorderPins(dto);
  }

  @ApiOperation({ summary: 'Find campaigns by category' })
  @Public()
  @Get('category/:categoryId')
  findByCategory(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.campaignsService.findByCategory(categoryId);
  }

  @ApiOperation({ summary: 'Find campaigns by status' })
  @Public()
  @Get('status/:status')
  findCampaignList(@Param('status') status: CampaignStatus) {
    return this.campaignsService.findCampaignList(status);
  }

  @ApiOperation({ summary: 'Create a new campaign' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  create(
    @Body() createCampaignDto: CreateCampaignDto,
    @Request() req: { user: User },
  ) {
    return this.campaignsService.create(createCampaignDto, req.user);
  }

  @ApiOperation({ summary: 'Toggle campaign pin state' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id/pin')
  togglePin(@Param('id', ParseUUIDPipe, CampaignExistsPipe) id: string) {
    return this.campaignsService.togglePin(id);
  }

  @ApiOperation({ summary: 'Update an existing campaign' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe, CampaignExistsPipe) id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @ApiOperation({ summary: 'Delete a campaign' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe, CampaignExistsPipe) id: string) {
    return this.campaignsService.remove(id);
  }

  @ApiOperation({ summary: 'Get campaign by ID (includes details)' })
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe, CampaignExistsPipe) id: string) {
    return this.campaignsService.findOne(id);
  }
}
