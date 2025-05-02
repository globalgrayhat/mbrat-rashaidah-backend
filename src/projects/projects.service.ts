import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async create(createProjectDto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepository.create(createProjectDto);
    return await this.projectRepository.save(project);
  }

  async findAll(): Promise<Project[]> {
    return await this.projectRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
    return project;
  }

  async update(id: string, updateProjectDto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, updateProjectDto);
    return await this.projectRepository.save(project);
  }

  async remove(id: string): Promise<void> {
    const result = await this.projectRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
  }

  async findByCategory(categoryId: string): Promise<Project[]> {
    const projects = await this.projectRepository.find({
      where: { categoryId },
      order: { createdAt: 'DESC' },
    });
    return projects;
  }

  async findByCountry(countryId: string): Promise<Project[]> {
    const projects = await this.projectRepository.find({
      where: { countryId },
      order: { createdAt: 'DESC' },
    });
    return projects;
  }

  async findProjectList(status: string): Promise<Project[]> {
    const projects = await this.projectRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
    return projects;
  }

  async findProjectDetails(projectId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['category', 'country', 'media'],
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    return project;
  }

  async getProjectStats(): Promise<{
    total: number;
    active: number;
    byCategory: { categoryId: string; count: number }[];
    byCountry: { countryId: string; count: number }[];
  }> {
    const [total, active, byCategory, byCountry] = await Promise.all([
      this.projectRepository.count(),
      this.projectRepository.count({ where: { isActive: true } }),
      this.projectRepository
        .createQueryBuilder('project')
        .select('project.categoryId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('project.categoryId')
        .getRawMany(),
      this.projectRepository
        .createQueryBuilder('project')
        .select('project.countryId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('project.countryId')
        .getRawMany(),
    ]);

    return {
      total,
      active,
      byCategory,
      byCountry,
    };
  }
}