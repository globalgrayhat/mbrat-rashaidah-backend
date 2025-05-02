import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContinentsController } from './continents.controller';
import { ContinentsService } from './continents.service';
import { Continent } from './entities/continent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Continent])],
  controllers: [ContinentsController],
  providers: [ContinentsService],
})
export class ContinentsModule {}
