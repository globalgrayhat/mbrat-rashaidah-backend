import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Get('category/:categoryId')
  fetchCategoryAjax(@Param('categoryId') categoryId: string) {
    return this.projectsService.findByCategory(categoryId);
  }

  @Get('country/:countryId')
  fetchCountryAjax(@Param('countryId') countryId: string) {
    return this.projectsService.findByCountry(countryId);
  }

  @Get('list/:status')
  fetchProjectListAjax(@Param('status') status: string) {
    return this.projectsService.findProjectList(status);
  }

  @Get('details/:projectId')
  fetchProjectDetailsAjax(@Param('projectId') projectId: string) {
    return this.projectsService.findProjectDetails(projectId);
  }

  @Get('stats')
  getProjectStats() {
    return this.projectsService.getProjectStats();
  }
}
