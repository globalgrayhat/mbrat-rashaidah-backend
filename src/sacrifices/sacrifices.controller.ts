import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { SacrificesService } from './sacrifices.service';

import { CreateSacrificeDto } from './dto/create-sacrifice.dto';
import { UpdateSacrificeDto } from './dto/update-sacrifice.dto';
import { CreateSacrificePriceDto } from './dto/create-sacrifice-price.dto';
import { UpdateSacrificePriceDto } from './dto/update-sacrifice-price.dto';
import { CreateSacrificeTypeDto } from './dto/create-sacrifice-type.dto';
import { UpdateSacrificeTypeDto } from './dto/update-sacrifice-type.dto';

@Controller('sacrifices')
export class SacrificesController {
  constructor(private readonly service: SacrificesService) {}

  /* ---------- Sacrifice endpoints ---------- */

  @Post()
  createSacrifice(@Body() dto: CreateSacrificeDto) {
    return this.service.createSacrifice(dto);
  }

  @Get()
  findAllSacrifices() {
    return this.service.findAllSacrifices();
  }

  @Get(':id')
  findOneSacrifice(@Param('id') id: string) {
    return this.service.findOneSacrifice(id);
  }

  @Patch(':id')
  updateSacrifice(@Param('id') id: string, @Body() dto: UpdateSacrificeDto) {
    return this.service.updateSacrifice(id, dto);
  }

  @Delete(':id')
  removeSacrifice(@Param('id') id: string) {
    return this.service.removeSacrifice(id);
  }

  /* ---------- Sacrifice-Price endpoints ---------- */
  /* Route prefix: /sacrifices/prices */

  @Post('prices')
  createPrice(@Body() dto: CreateSacrificePriceDto) {
    return this.service.createPrice(dto);
  }

  @Get('prices')
  findAllPrices() {
    return this.service.findAllPrices();
  }

  @Get('prices/:id')
  findOnePrice(@Param('id') id: string) {
    return this.service.findOnePrice(id);
  }

  @Patch('prices/:id')
  updatePrice(@Param('id') id: string, @Body() dto: UpdateSacrificePriceDto) {
    return this.service.updatePrice(id, dto);
  }

  @Delete('prices/:id')
  removePrice(@Param('id') id: string) {
    return this.service.removePrice(id);
  }
  /* ------- Type endpoints  (prefix: /types) ------- */
  @Post('types')
  createType(@Body() dto: CreateSacrificeTypeDto) {
    return this.service.createType(dto);
  }

  @Get('types')
  findAllTypes() {
    return this.service.findAllTypes();
  }

  @Get('types/:id')
  findOneType(@Param('id') id: string) {
    return this.service.findOneType(id);
  }

  @Patch('types/:id')
  updateType(@Param('id') id: string, @Body() dto: UpdateSacrificeTypeDto) {
    return this.service.updateType(id, dto);
  }

  @Delete('types/:id')
  removeType(@Param('id') id: string) {
    return this.service.removeType(id);
  }
}
