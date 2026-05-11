import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationService } from '../common/pagination/pagination.service';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { CollectionResponseDto } from '../common/pagination/dto/collection-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly paginationService: PaginationService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.repo.create(dto);
    return this.repo.save(user);
  }

  async list(query: PaginationQueryDto): Promise<CollectionResponseDto<User>> {
    const params = this.paginationService.normalizeParams(query);
    const { skip, take, search } = params;

    const queryBuilder = this.repo.createQueryBuilder('user');

    if (search) {
      queryBuilder.andWhere(
        '(user.username LIKE :search OR user.email LIKE :search OR user.fullName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder
      .orderBy(`user.${query.sortBy || 'createdAt'}`, query.sortOrder || 'DESC');

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return this.paginationService.createResponse(data, total, query);
  }

  async findAll(): Promise<User[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<User> {
    const u = await this.repo.findOneBy({ id });
    if (!u) throw new NotFoundException();
    return u;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOneBy({ username });
  }

  async updateByEmail(email: string, dto: UpdateUserDto): Promise<User | null> {
    await this.repo.update({ email }, dto);
    return this.findByEmail(email);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
