import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Role } from '../common/constants/roles.constant';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.repo.findOneBy({ id });
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
