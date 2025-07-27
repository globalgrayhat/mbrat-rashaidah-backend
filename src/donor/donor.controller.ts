import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { DonorsService } from './donor.service';

@Controller('donors')
export class DonorController {
  constructor(private readonly donorService: DonorsService) {}

  @Post()
  create(@Body() body: any) {
    return this.donorService.create(body);
  }

  @Get()
  findAll() {
    return this.donorService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.donorService.findOne(id);
  }
}
