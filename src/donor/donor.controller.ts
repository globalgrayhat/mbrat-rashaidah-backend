import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
  Patch,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DonorsService } from './donor.service';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { ApiCollectionResponse } from '../common/pagination/decorators/api-collection-response.decorator';
import { Donor } from './entities/donor.entity';
import { DonorExistsPipe } from '../common/pipes/donorExists.pipe';

@ApiTags('Donors')
@Controller('donors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DonorController {
  constructor(private readonly donorService: DonorsService) {}

  @ApiOperation({ summary: 'List all donors with pagination' })
  @ApiCollectionResponse(Donor)
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.donorService.list(query);
  }

  @ApiOperation({ summary: 'Create a new donor' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  create(@Body() createDonorDto: CreateDonorDto) {
    return this.donorService.create(createDonorDto);
  }

  @ApiOperation({ summary: 'Update an existing donor' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe, DonorExistsPipe) id: string,
    @Body() updateDonorDto: UpdateDonorDto,
  ) {
    return this.donorService.update(id, updateDonorDto);
  }

  @ApiOperation({ summary: 'Delete a donor' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe, DonorExistsPipe) id: string) {
    return this.donorService.remove(id);
  }

  @ApiOperation({ summary: 'Get donor by ID' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe, DonorExistsPipe) id: string) {
    return this.donorService.findOne(id);
  }
}
