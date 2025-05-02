import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/constants/roles.constant';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll() {
    return this.adminService.findAll();
  }

  @Get('users/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.adminService.findOne(id);
  }

  @Post('users/:id/role')
  @Roles(Role.SUPER_ADMIN)
  updateRole(@Param('id') id: string, @Body('role') role: Role) {
    return this.adminService.updateRole(id, role);
  }

  @Delete('users/:id')
  @Roles(Role.SUPER_ADMIN)
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }
}
