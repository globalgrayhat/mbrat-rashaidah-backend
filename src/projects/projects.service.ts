// [FIXED 2025-06-04]
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Category } from '../categories/entities/category.entity';
import { Country } from '../countries/entities/country.entity';
import { Continent } from '../continents/entities/continent.entity';
import { Media } from '../media/entities/media.entity';
import { ProjectStatus } from '../common/constants/project.constant';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @InjectRepository(Continent)
    private readonly continentRepository: Repository<Continent>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  async create(createProjectDto: CreateProjectDto): Promise<Project> {
    const { categoryId, countryId, continentId, mediaIds = [] } = createProjectDto;

    // Verify category exists
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    // Verify country exists
    const country = await this.countryRepository.findOne({
      where: { id: countryId },
    });
    if (!country) {
      throw new NotFoundException(`Country with ID ${countryId} not found`);
    }

    // Verify continent exists
    const continent = await this.continentRepository.findOne({
      where: { id: continentId },
    });
    if (!continent) {
      throw new NotFoundException(`Continent with ID ${continentId} not found`);
    }

    // Create project
    const project = this.projectRepository.create({
      ...createProjectDto,
      categoryId,
      countryId,
      continentId,
      status: ProjectStatus.DRAFT,
    });

    // Attach media if provided
    if (mediaIds.length > 0) {
      const medias = await this.mediaRepository.findByIds(mediaIds);
      if (medias.length !== mediaIds.length) {
        throw new NotFoundException('One or more media items not found');
      }
      project.media = medias;
    }

    return this.projectRepository.save(project);
  }

  async findAll(): Promise<Project[]> {
    return await this.projectRepository.find({
      relations: ['category', 'country', 'continent', 'media'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['category', 'country', 'continent', 'media'],
    });
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
      relations: ['category', 'country', 'continent', 'media'],
      order: { createdAt: 'DESC' },
    });
    return projects;
  }

  async findByCountry(countryId: string): Promise<Project[]> {
    const projects = await this.projectRepository.find({
      where: { countryId },
      relations: ['category', 'country', 'continent', 'media'],
      order: { createdAt: 'DESC' },
    });
    return projects;
  }

  async findProjectList(status: ProjectStatus): Promise<Project[]> {
    const projects = await this.projectRepository.find({
      where: { status },
      relations: ['category', 'country', 'continent', 'media'],
      order: { createdAt: 'DESC' },
    });
    return projects;
  }

  async findProjectDetails(projectId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['category', 'country', 'continent', 'media'],
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