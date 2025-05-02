import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository, UpdateResult } from 'typeorm'; // Import UpdateResult and DeleteResult
import { Continent } from './entities/continent.entity'; // Ensure this path is correct
import { CreateContinentDto } from './dto/create-continent.dto'; // Ensure this path is correct
import { UpdateContinentDto } from './dto/update-continent.dto'; // Ensure this path is correct

@Injectable()
export class ContinentsService {
  constructor(
    @InjectRepository(Continent)
    private continentRepository: Repository<Continent>,
  ) {}

  async create(createContinentDto: CreateContinentDto): Promise<Continent> {
    // Added return type
    const continent = this.continentRepository.create(createContinentDto);
    return this.continentRepository.save(continent);
  }

  async findAll(): Promise<Continent[]> {
    // Added explicit return type for array
    return this.continentRepository.find();
  }

  async findOne(id: string): Promise<Continent | null> {
    // Added return type, Continent or null
    // Corrected findOne usage to use options object
    return this.continentRepository.findOne({ where: { id: id } });
  }

  async update(
    id: string,
    updateContinentDto: UpdateContinentDto,
  ): Promise<UpdateResult> {
    // Added return type
    return this.continentRepository.update(id, updateContinentDto);
  }

  async remove(id: string): Promise<DeleteResult> {
    // Added return type
    return this.continentRepository.delete(id);
  }
}
