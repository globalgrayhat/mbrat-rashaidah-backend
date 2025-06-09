import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Category } from '../categories/entities/category.entity';
import { Country } from '../countries/entities/country.entity';
import { Continent } from '../continents/entities/continent.entity';
import { Media } from '../media/entities/media.entity';
import { ProjectStatus } from '../common/constants/project.constant';
export declare class ProjectsService {
    private readonly projectRepository;
    private readonly categoryRepository;
    private readonly countryRepository;
    private readonly continentRepository;
    private readonly mediaRepository;
    constructor(projectRepository: Repository<Project>, categoryRepository: Repository<Category>, countryRepository: Repository<Country>, continentRepository: Repository<Continent>, mediaRepository: Repository<Media>);
    create(createProjectDto: CreateProjectDto): Promise<Project>;
    findAll(): Promise<Project[]>;
    findOne(id: string): Promise<Project>;
    update(id: string, updateProjectDto: UpdateProjectDto): Promise<Project>;
    remove(id: string): Promise<void>;
    findByCategory(categoryId: string): Promise<Project[]>;
    findByCountry(countryId: string): Promise<Project[]>;
    findProjectList(status: ProjectStatus): Promise<Project[]>;
    findProjectDetails(projectId: string): Promise<Project>;
    getProjectStats(): Promise<{
        total: number;
        active: number;
        byCategory: {
            categoryId: string;
            count: number;
        }[];
        byCountry: {
            countryId: string;
            count: number;
        }[];
    }>;
}
