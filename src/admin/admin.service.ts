import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Role } from '../common/constants/roles.constant';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { PaginationService } from '../common/pagination/pagination.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly paginationService: PaginationService,
  ) {}

  async list(query: PaginationQueryDto) {
    const params = this.paginationService.normalizeParams(query);
    const { skip, take, search } = params;

    const queryBuilder = this.repo.createQueryBuilder('user');

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName LIKE :search OR user.email LIKE :search OR user.username LIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy(
      `user.${query.sortBy || 'createdAt'}`,
      query.sortOrder || 'DESC',
    );

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return this.paginationService.createResponse(data, total, query);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async updateRole(id: string, role: Role): Promise<User> {
    const user = await this.findOne(id);
    user.role = role;
    return this.repo.save(user);
  }

  async deleteUser(id: string): Promise<void> {
    const { affected } = await this.repo.delete(id);
    if (!affected) throw new NotFoundException(`User with ID ${id} not found`);
  }
}
