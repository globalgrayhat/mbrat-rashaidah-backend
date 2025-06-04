import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ContinentsService } from './continents.service';
import { CreateContinentDto } from './dto/create-continent.dto';
import { UpdateContinentDto } from './dto/update-continent.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';

@Controller('continents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContinentsController {
  constructor(private readonly continentsService: ContinentsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() createContinentDto: CreateContinentDto) {
    return this.continentsService.create(createContinentDto);
  }

  @Get()
  findAll() {
    return this.continentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.continentsService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Param('id') id: string, @Body() updateContinentDto: UpdateContinentDto) {
    return this.continentsService.update(id, updateContinentDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.continentsService.remove(id);
  }
}