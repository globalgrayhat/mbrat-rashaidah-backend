import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Category } from '../categories/entities/category.entity';
import { Country } from '../countries/entities/country.entity';
import { Continent } from '../continents/entities/continent.entity';
import { Media } from '../media/entities/media.entity';
import { ProjectStatus } from '../common/constants/project.constant';
import { User } from '../user/entities/user.entity';
import { PaginationService } from '../common/pagination/pagination.service';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { CollectionResponseDto } from '../common/pagination/dto/collection-response.dto';
import { ReorderPinnedDto } from '../common/pagination/dto/reorder-pinned.dto';

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
    private readonly paginationService: PaginationService,
  ) {}

  private async ensureEntityExists<T extends Record<string, any>>(
    repo: Repository<T>,
    id: string,
    entityName: string,
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const entity = await repo.findOne({ where: { id: id as any } });
    if (!entity) {
      throw new NotFoundException(`${entityName} with ID "${id}" not found.`);
    }
    return entity;
  }

  private async ensureSlugUnique(slug: string): Promise<void> {
    const existing = await this.projectRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Slug "${slug}" is already in use.`);
    }
  }

  async create(
    createProjectDto: CreateProjectDto,
    user: User,
  ): Promise<Project> {
    const {
      title,
      slug,
      categoryId,
      countryId,
      continentId,
      mediaIds = [],
      // other fields (description, location, startDate, etc.) get spread in below
    } = createProjectDto;

    // 1) Check slug uniqueness up-front
    const existingBySlug = await this.projectRepository.findOne({
      where: { slug },
    });
    if (existingBySlug) {
      // you could choose 409 Conflict or 400 Bad Request
      throw new ConflictException(`Slug "${slug}" is already in use.`);
    }

    // 2) Verify Category exists
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Category with ID "${categoryId}" not found.`,
      );
    }

    // 3) Verify Country exists
    const country = await this.countryRepository.findOne({
      where: { id: countryId },
    });
    if (!country) {
      throw new NotFoundException(`Country with ID "${countryId}" not found.`);
    }

    // 4) Verify Continent exists
    const continent = await this.continentRepository.findOne({
      where: { id: continentId },
    });
    if (!continent) {
      throw new NotFoundException(
        `Continent with ID "${continentId}" not found.`,
      );
    }

    // 5) Prepare the Project entity
    const project = this.projectRepository.create({
      title,
      slug,
      description: createProjectDto.description,
      location: createProjectDto.location,
      startDate: createProjectDto.startDate,
      endDate: createProjectDto.endDate,
      targetAmount: createProjectDto.targetAmount,
      currentAmount: createProjectDto.currentAmount ?? 0, // Ensure currentAmount has a default
      categoryId,
      countryId,
      continentId,
      status: ProjectStatus.DRAFT,
      isActive: createProjectDto.isActive ?? true,
      isDonationActive: createProjectDto.isDonationActive ?? true, // Default to true
      isProgressActive: createProjectDto.isProgressActive ?? true, // Default to true
      isTargetAmountActive: createProjectDto.isTargetAmountActive ?? true, // Default to true
      donationGoal: createProjectDto.donationGoal,
      donationCount: 0, // Initialize donationCount
      viewCount: 0, // Initialize viewCount
      createdById: user.id,
      isPinned: createProjectDto.isPinned ?? false,
      // viewCount, donationCount, createdById, etc. remain default/null
    });

    // 6) Attach media if provided
    if (mediaIds.length > 0) {
      const medias = await this.mediaRepository.findByIds(mediaIds);
      if (medias.length !== mediaIds.length) {
        throw new NotFoundException(`One or more media items not found.`);
      }
      project.media = medias;
    }

    // 7) Save & catch any unexpected uniqueness violation at the DB layer
    try {
      return await this.projectRepository.save(project);
    } catch (err) {
      // In case a race condition allowed a duplicate-slug slip through
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException(`Project slug "${slug}" already exists.`);
      }
      // Bubble up any other error
      throw err;
    }
  }

  async list(query: PaginationQueryDto): Promise<CollectionResponseDto<Project>> {
    const params = this.paginationService.normalizeParams(query);
    const { skip, take, search } = params;

    const queryBuilder = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.category', 'category')
      .leftJoinAndSelect('project.country', 'country')
      .leftJoinAndSelect('project.continent', 'continent')
      .leftJoinAndSelect('project.media', 'media');

    queryBuilder.andWhere('project.isActive = :isActive', { isActive: true });
    queryBuilder.andWhere('project.status = :status', { status: ProjectStatus.ACTIVE });

    if (search) {
      queryBuilder.andWhere(
        '(project.title LIKE :search OR project.description LIKE :search OR project.slug LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (query.categoryId) {
      queryBuilder.andWhere('project.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.countryId) {
      queryBuilder.andWhere('project.countryId = :countryId', {
        countryId: query.countryId,
      });
    }

    // Default sorting: Pinned first, then by pinnedOrder, then by createdAt
    queryBuilder
      .orderBy('project.isPinned', 'DESC')
      .addOrderBy('project.pinnedOrder', 'ASC')
      .addOrderBy(`project.${query.sortBy || 'createdAt'}`, query.sortOrder || 'DESC');

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return this.paginationService.createResponse(data, total, query);
  }

  async togglePin(id: string): Promise<Project> {
    const project = await this.findOne(id);
    project.isPinned = !project.isPinned;
    // When pinning, we might want to put it at the top (order 0)
    if (project.isPinned && project.pinnedOrder === 0) {
      // Logic could be added here to find the current min pinnedOrder
    }
    return this.projectRepository.save(project);
  }

  async reorderPins(dto: ReorderPinnedDto): Promise<void> {
    const updatePromises = dto.items.map((item) =>
      this.projectRepository.update(item.id, {
        pinnedOrder: item.pinnedOrder,
        isPinned: true, // Ensure it's pinned if it's being reordered
      }),
    );
    await Promise.all(updatePromises);
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['category', 'country', 'continent', 'media', 'donations'],
    });
    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found.`);
    }
    return project;
  }

  async incrementViewCount(id: string): Promise<{ success: boolean }> {
    await this.projectRepository.increment({ id }, 'viewCount', 1);
    return { success: true };
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.findOne(id);

    if (updateProjectDto.slug && updateProjectDto.slug !== project.slug) {
      await this.ensureSlugUnique(updateProjectDto.slug);
    }

    if (updateProjectDto.categoryId) {
      await this.ensureEntityExists(
        this.categoryRepository,
        updateProjectDto.categoryId,
        'Category',
      );
    }
    if (updateProjectDto.countryId) {
      await this.ensureEntityExists(
        this.countryRepository,
        updateProjectDto.countryId,
        'Country',
      );
    }
    if (updateProjectDto.continentId) {
      await this.ensureEntityExists(
        this.continentRepository,
        updateProjectDto.continentId,
        'Continent',
      );
    }

    Object.assign(project, updateProjectDto);

    if (updateProjectDto.mediaIds) {
      const medias = await this.mediaRepository.findByIds(
        updateProjectDto.mediaIds,
      );
      const foundIds = medias.map((m) => m.id);
      const missingIds = updateProjectDto.mediaIds.filter(
        (id) => !foundIds.includes(id),
      );
      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Media items not found: ${missingIds.join(', ')}`,
        );
      }
      project.media = medias;
    }

    try {
      return await this.projectRepository.save(project);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        typeof err === 'object' &&
        err !== null &&
        typeof (err as { code?: unknown }).code === 'string' &&
        (err as unknown as { code: string }).code === '23505'
      ) {
        throw new ConflictException(
          `Project slug "${updateProjectDto.slug}" already exists.`,
        );
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.projectRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Project with ID "${id}" not found.`);
    }
  }

  async findByCategory(categoryId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { categoryId },
      relations: ['category', 'country', 'continent', 'media'],
      order: { isPinned: 'DESC', pinnedOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findByCountry(countryId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { countryId },
      relations: ['category', 'country', 'continent', 'media'],
      order: { isPinned: 'DESC', pinnedOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findProjectList(status: ProjectStatus): Promise<Project[]> {
    return this.projectRepository.find({
      where: { status },
      relations: ['category', 'country', 'continent', 'media'],
      order: { isPinned: 'DESC', pinnedOrder: 'ASC', createdAt: 'DESC' },
    });
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
        .where('project.isActive = :isActive', { isActive: true })
        .select('project.categoryId', 'categoryId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('project.categoryId')
        .getRawMany(),
      this.projectRepository
        .createQueryBuilder('project')
        .where('project.isActive = :isActive', { isActive: true })
        .select('project.countryId', 'countryId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('project.countryId')
        .getRawMany(),
    ]);

    return {
      total,
      active,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      byCategory,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      byCountry,
    };
  }
}
