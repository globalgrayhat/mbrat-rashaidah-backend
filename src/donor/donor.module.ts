import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DonorsService } from './donor.service';
import { DonorController } from './donor.controller';
import { Donor } from './entities/donor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Donor])],
  providers: [DonorsService],
  controllers: [DonorController],
  exports: [DonorsService],
})
export class DonorModule {}
