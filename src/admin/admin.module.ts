import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '../user/entities/user.entity';

import { PaginationModule } from '../common/pagination/pagination.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), PaginationModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
