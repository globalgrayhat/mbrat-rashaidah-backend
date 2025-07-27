import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DonorsService } from './donor.service';
import { DonorController } from './donor.controller';
import { Donor } from './entities/donor.entity';
import { User } from '../user/entities/user.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Donor, User])],
  providers: [DonorsService],
  controllers: [DonorController],
  exports: [DonorsService],
})
export class DonorModule {}
