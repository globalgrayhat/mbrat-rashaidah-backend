import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectStatus } from '../common/constants/project.constant';
export declare class ProjectsController {
    private readonly projectsService;
    constructor(projectsService: ProjectsService);
    create(createProjectDto: CreateProjectDto): Promise<import("./entities/project.entity").Project>;
    findAll(): Promise<import("./entities/project.entity").Project[]>;
    findOne(id: string): Promise<import("./entities/project.entity").Project>;
    update(id: string, updateProjectDto: UpdateProjectDto): Promise<import("./entities/project.entity").Project>;
    remove(id: string): Promise<void>;
    findByCategory(categoryId: string): Promise<import("./entities/project.entity").Project[]>;
    findByCountry(countryId: string): Promise<import("./entities/project.entity").Project[]>;
    findProjectList(status: ProjectStatus): Promise<import("./entities/project.entity").Project[]>;
    findProjectDetails(projectId: string): Promise<import("./entities/project.entity").Project>;
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
