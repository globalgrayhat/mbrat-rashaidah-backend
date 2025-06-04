import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/createCampaignDto';
import { campaignExistsPipe } from 'src/common/pipes/campaignExists.pipe';
import { UpdateCampaignDto } from './dto/UpdateCampaignDto';
import { CampaignPurposeEnum } from '../common/constants/campaignPurpose.constant'; 
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';


@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getCampaigns(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query(
      'purpose',
      new ParseEnumPipe(CampaignPurposeEnum, {
        optional: true,
      }),
    )
    purpose: string,
    @Query('search') search: string,
  ) {
    const CAMPAIGNS_PER_PAGE = 5;
    return this.campaignsService.getCampaigns(
      search,
      purpose,
      page,
      CAMPAIGNS_PER_PAGE,
    );
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  addCampaign(@Req() req, @Body() createCampaignDto: CreateCampaignDto) {
    const userId: string = req.user.userId;
    return this.campaignsService.addCampaign(createCampaignDto, userId);
  }

  @Get(':id')
  @UsePipes(campaignExistsPipe)
  getCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.getCampaign(id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UsePipes(campaignExistsPipe)
  editCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() UpdateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignsService.editCampaign(id, UpdateCampaignDto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  @UsePipes(campaignExistsPipe)
  deleteCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.deleteCampaign(id);
  }
}
