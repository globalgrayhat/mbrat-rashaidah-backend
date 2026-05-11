import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';
import { IsEnum } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { ApiCollectionResponse } from '../common/pagination/decorators/api-collection-response.decorator';
import { User } from '../user/entities/user.entity';

class UpdateRoleDto {
  @IsEnum(Role)
  role: Role;
}

@ApiTags('Admin Management')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'List all users (Admin view) with pagination' })
  @ApiCollectionResponse(User)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('users')
  findAll(@Query() query: PaginationQueryDto) {
    return this.adminService.list(query);
  }

  @ApiOperation({ summary: 'Get a user by ID (Admin view)' })
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('users/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a user role' })
  @Roles(Role.SUPER_ADMIN)
  @Post('users/:id/role')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.adminService.updateRole(id, updateRoleDto.role);
  }

  @ApiOperation({ summary: 'Delete a user' })
  @Roles(Role.SUPER_ADMIN)
  @Delete('users/:id')
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteUser(id);
  }
}
