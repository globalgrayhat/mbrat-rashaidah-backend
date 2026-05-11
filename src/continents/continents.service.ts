import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository, UpdateResult } from 'typeorm'; // Import UpdateResult and DeleteResult
import { Continent } from './entities/continent.entity'; // Ensure this path is correct
import { CreateContinentDto } from './dto/create-continent.dto';
import { UpdateContinentDto } from './dto/update-continent.dto';
import { PaginationService } from '../common/pagination/pagination.service';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { CollectionResponseDto } from '../common/pagination/dto/collection-response.dto';

@Injectable()
export class ContinentsService {
  constructor(
    @InjectRepository(Continent)
    private readonly continentRepository: Repository<Continent>,
    private readonly paginationService: PaginationService,
  ) {}

  async create(createContinentDto: CreateContinentDto): Promise<Continent> {
    // Added return type
    const continent = this.continentRepository.create(createContinentDto);
    return this.continentRepository.save(continent);
  }

  async list(query: PaginationQueryDto): Promise<CollectionResponseDto<Continent>> {
    const params = this.paginationService.normalizeParams(query);
    const { skip, take, search } = params;

    const queryBuilder = this.continentRepository.createQueryBuilder('continent');

    if (search) {
      queryBuilder.andWhere(
        '(continent.name LIKE :search OR continent.code LIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder
      .orderBy(`continent.${query.sortBy || 'createdAt'}`, query.sortOrder || 'DESC');

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return this.paginationService.createResponse(data, total, query);
  }

  async findAll(): Promise<Continent[]> {
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
