import { User } from '../../user/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
export declare class Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    color?: string;
    order: number;
    isActive: boolean;
    projects: Project[];
    createdAt: Date;
    updatedAt: Date;
    createdBy?: User;
    createdById?: string;
}
