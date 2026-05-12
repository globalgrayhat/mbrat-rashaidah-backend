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
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import { ProjectStatus } from '../common/constants/project.constant';
import { ProjectExistsPipe } from '../common/pipes/projectExists.pipe';
import { User } from '../user/entities/user.entity';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { ApiCollectionResponse } from '../common/pagination/decorators/api-collection-response.decorator';
import { Project } from './entities/project.entity';
import { ReorderPinnedDto } from '../common/pagination/dto/reorder-pinned.dto';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOperation({ summary: 'List all projects with pagination and filters' })
  @ApiCollectionResponse(Project)
  @Public()
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.projectsService.list(query);
  }

  @ApiOperation({ summary: 'List all projects for admin (including inactive)' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('admin/all')
  findAllForAdmin(@Query() query: PaginationQueryDto) {
    return this.projectsService.listAllForAdmin(query);
  }

  @ApiOperation({ summary: 'Get summary statistics for projects' })
  @Public()
  @Get('stats/summary')
  getProjectStats() {
    return this.projectsService.getProjectStats();
  }

  @ApiOperation({ summary: 'Reorder pinned projects' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch('pins/reorder')
  reorderPins(@Body() dto: ReorderPinnedDto) {
    return this.projectsService.reorderPins(dto);
  }

  @ApiOperation({ summary: 'Find projects by category' })
  @Public()
  @Get('category/:categoryId')
  findByCategory(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.projectsService.findByCategory(categoryId);
  }

  @ApiOperation({ summary: 'Find projects by country' })
  @Public()
  @Get('country/:countryId')
  findByCountry(@Param('countryId', ParseUUIDPipe) countryId: string) {
    return this.projectsService.findByCountry(countryId);
  }

  @ApiOperation({ summary: 'Find projects by status' })
  @Public()
  @Get('status/:status')
  findProjectList(@Param('status') status: ProjectStatus) {
    return this.projectsService.findProjectList(status);
  }

  @ApiOperation({ summary: 'Create a new project' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Request() req: { user: User },
  ) {
    return this.projectsService.create(createProjectDto, req.user);
  }

  @ApiOperation({ summary: 'Toggle project pin state' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id/pin')
  togglePin(@Param('id', ParseUUIDPipe, ProjectExistsPipe) id: string) {
    return this.projectsService.togglePin(id);
  }

  @ApiOperation({ summary: 'Update an existing project' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe, ProjectExistsPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @ApiOperation({ summary: 'Delete a project' })
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe, ProjectExistsPipe) id: string) {
    return this.projectsService.remove(id);
  }

  @ApiOperation({ summary: 'Get project by ID (includes details)' })
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(id);
  }

  @ApiOperation({ summary: 'Increment view count for a project' })
  @Public()
  @Post(':id/view')
  incrementView(@Param('id', ParseUUIDPipe, ProjectExistsPipe) id: string) {
    return this.projectsService.incrementViewCount(id);
  }
}
