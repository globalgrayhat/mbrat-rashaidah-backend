import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Sacrifice } from './sacrifice.entity';
import { SacrificePrice } from './sacrifices-prices/entities/sacrifice-price.entity';
import { SacrificeType } from './sacrifices-types/entities/sacrifice-type.entity';

import { SacrificesService } from './sacrifices.service';
import { SacrificesController } from './sacrifices.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sacrifice, SacrificePrice, SacrificeType]),
  ],
  controllers: [SacrificesController],
  providers: [SacrificesService],
  exports: [SacrificesService],
})
export class SacrificesModule {}
