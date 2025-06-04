import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation } from '../donations/entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import { ConfigModule } from '@nestjs/config';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    ConfigModule,
    ProjectsModule,
    TypeOrmModule.forFeature([Donation, Project]),
  ],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
