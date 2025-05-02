import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';

import { Sacrifice } from './sacrifice.entity';
import { SacrificePrice } from './sacrifices-prices/entities/sacrifice-price.entity';
import { SacrificeType } from './sacrifices-types/entities/sacrifice-type.entity';
import { CreateSacrificeDto } from './dto/create-sacrifice.dto';
import { UpdateSacrificeDto } from './dto/update-sacrifice.dto';
import { CreateSacrificePriceDto } from './dto/create-sacrifice-price.dto';
import { UpdateSacrificePriceDto } from './dto/update-sacrifice-price.dto';
import { CreateSacrificeTypeDto } from './dto/create-sacrifice-type.dto';
import { UpdateSacrificeTypeDto } from './dto/update-sacrifice-type.dto';

@Injectable()
export class SacrificesService {
  constructor(
    /* ---------- Repositories ---------- */
    @InjectRepository(Sacrifice)
    private readonly sacrificesRepo: Repository<Sacrifice>,

    @InjectRepository(SacrificePrice)
    private readonly pricesRepo: Repository<SacrificePrice>,

    @InjectRepository(SacrificeType)
    private readonly typesRepo: Repository<SacrificeType>,
  ) {}

  /* ========== Sacrifice CRUD ========== */

  createSacrifice(dto: CreateSacrificeDto) {
    const ent = this.sacrificesRepo.create(dto as DeepPartial<Sacrifice>);
    return this.sacrificesRepo.save(ent);
  }

  findAllSacrifices() {
    return this.sacrificesRepo.find();
  }

  findOneSacrifice(id: string) {
    return this.sacrificesRepo.findOne({ where: { id } });
  }

  async updateSacrifice(id: string, dto: UpdateSacrificeDto) {
    const merged = await this.sacrificesRepo.preload({ id, ...dto });
    if (!merged) throw new NotFoundException(`Sacrifice ${id} غير موجود`);
    return this.sacrificesRepo.save(merged);
  }

  removeSacrifice(id: string) {
    return this.sacrificesRepo.delete(id);
  }

  /* ======== Sacrifice-Price CRUD ======== */

  createPrice(dto: CreateSacrificePriceDto) {
    const ent = this.pricesRepo.create(dto as DeepPartial<SacrificePrice>);
    return this.pricesRepo.save(ent);
  }

  findAllPrices() {
    return this.pricesRepo.find();
  }

  findOnePrice(id: string) {
    return this.pricesRepo.findOne({ where: { id } });
  }

  async updatePrice(id: string, dto: UpdateSacrificePriceDto) {
    const merged = await this.pricesRepo.preload({ id, ...dto });
    if (!merged) throw new NotFoundException(`السعر ${id} غير موجود`);
    return this.pricesRepo.save(merged);
  }

  removePrice(id: string) {
    return this.pricesRepo.delete(id);
  }

  /* ========= Sacrifice-Type CRUD ========= */

  createType(dto: CreateSacrificeTypeDto) {
    const ent = this.typesRepo.create(dto as DeepPartial<SacrificeType>);
    return this.typesRepo.save(ent);
  }

  findAllTypes() {
    return this.typesRepo.find();
  }

  findOneType(id: string) {
    return this.typesRepo.findOne({ where: { id } });
  }

  async updateType(id: string, dto: UpdateSacrificeTypeDto) {
    const merged = await this.typesRepo.preload({ id, ...dto });
    if (!merged) throw new NotFoundException(`Type ${id} غير موجود`);
    return this.typesRepo.save(merged);
  }

  removeType(id: string) {
    return this.typesRepo.delete(id);
  }
}
