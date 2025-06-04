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
import { EditCampaignDto } from './dto/editCampaignDto';
import { AuthRolesEnum, CampaignPurposeEnum } from 'src/common/enums';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Role } from 'src/common/decorators/role.decorator';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
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

  @UseGuards(JwtGuard, RoleGuard)
  @Role(AuthRolesEnum.VERIFIED)
  @Post()
  addCampaign(@Req() req, @Body() createCampaignDto: CreateCampaignDto) {
    const userId: string = req.user.userId;
    return this.campaignsService.addCampaign(createCampaignDto, userId);
  }

  @Get(':id')
  @UsePipes(campaignExistsPipe)
  getCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.getCampaign(id);
  }

  @UseGuards(JwtGuard, RoleGuard)
  @Role(AuthRolesEnum.CAMPAIGN_OWNER)
  @Put(':id')
  @UsePipes(campaignExistsPipe)
  editCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() editCampaignDto: EditCampaignDto,
  ) {
    return this.campaignsService.editCampaign(id, editCampaignDto);
  }

  @UseGuards(JwtGuard, RoleGuard)
  @Role(AuthRolesEnum.CAMPAIGN_OWNER)
  @Delete(':id')
  @UsePipes(campaignExistsPipe)
  deleteCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.deleteCampaign(id);
  }
}
