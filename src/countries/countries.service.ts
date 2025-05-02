import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Country } from './entities/country.entity';

import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {}

  /* ---------- CREATE ---------- */
  create(dto: CreateCountryDto) {
    // حوّل الـ DTO إلى DeepPartial<Country>
    const entity = this.countryRepository.create(dto as DeepPartial<Country>);
    return this.countryRepository.save(entity);
  }

  /* ---------- READ ---------- */
  findAll() {
    return this.countryRepository.find();
  }

  findOne(id: string) {
    // TypeORM v0.3 — تمرير object
    return this.countryRepository.findOne({ where: { id } });
    // أو: return this.countryRepository.findOneBy({ id });
  }

  /* ---------- UPDATE ---------- */
  async update(id: string, dto: UpdateCountryDto) {
    // preload + save يضمن تطابق الأنواع ويرجع النسخة المحدثة
    const merged = await this.countryRepository.preload({
      id,
      ...dto,
    } as DeepPartial<Country>);

    if (!merged) throw new NotFoundException(`Country ${id} غير موجود`);
    return this.countryRepository.save(merged);
  }

  /* ---------- DELETE ---------- */
  remove(id: string) {
    return this.countryRepository.delete(id);
  }
}
