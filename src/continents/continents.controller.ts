import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContinentsService } from './continents.service';
import { CreateContinentDto } from './dto/create-continent.dto';
import { UpdateContinentDto } from './dto/update-continent.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { ApiCollectionResponse } from '../common/pagination/decorators/api-collection-response.decorator';
import { Continent } from './entities/continent.entity';

@ApiTags('Continents')
@Controller('continents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContinentsController {
  constructor(private readonly continentsService: ContinentsService) {}

  @ApiOperation({ summary: 'List all continents with pagination' })
  @ApiCollectionResponse(Continent)
  @Public()
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.continentsService.list(query);
  }

  @ApiOperation({ summary: 'Create a new continent' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  create(@Body() createContinentDto: CreateContinentDto) {
    return this.continentsService.create(createContinentDto);
  }

  @ApiOperation({ summary: 'Update an existing continent' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateContinentDto: UpdateContinentDto,
  ) {
    return this.continentsService.update(id, updateContinentDto);
  }

  @ApiOperation({ summary: 'Delete a continent' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.continentsService.remove(id);
  }

  @ApiOperation({ summary: 'Get continent by ID' })
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.continentsService.findOne(id);
  }
}
