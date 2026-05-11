import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import { User } from '../user/entities/user.entity';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { ApiCollectionResponse } from '../common/pagination/decorators/api-collection-response.decorator';
import { Banner } from './entities/banner.entity';
import { ReorderPinnedDto } from '../common/pagination/dto/reorder-pinned.dto';

@ApiTags('Banners')
@Controller('banners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @ApiOperation({ summary: 'List all banners with pagination' })
  @ApiCollectionResponse(Banner)
  @Public()
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.bannersService.list(query);
  }

  @ApiOperation({ summary: 'Reorder pinned banners' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch('pins/reorder')
  reorderPins(@Body() dto: ReorderPinnedDto) {
    return this.bannersService.reorderPins(dto);
  }

  @ApiOperation({ summary: 'Create a new banner' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  create(
    @Body() createBannerDto: CreateBannerDto,
    @Request() req: { user: User },
  ) {
    return this.bannersService.create(createBannerDto, req.user);
  }

  @ApiOperation({ summary: 'Toggle banner pin state' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id/pin')
  togglePin(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannersService.togglePin(id);
  }

  @ApiOperation({ summary: 'Update an existing banner' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBannerDto: UpdateBannerDto,
  ) {
    return this.bannersService.update(id, updateBannerDto);
  }

  @ApiOperation({ summary: 'Delete a banner' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannersService.remove(id);
  }

  @ApiOperation({ summary: 'Get banner by ID' })
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannersService.findOne(id);
  }
}
