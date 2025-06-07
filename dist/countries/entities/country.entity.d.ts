import { Project } from '../../projects/entities/project.entity';
import { Continent } from '../../continents/entities/continent.entity';
export declare class Country {
    id: string;
    name: string;
    code: string;
    flagUrl?: string;
    phoneCode?: string;
    currencyCode?: string;
    currencySymbol?: string;
    isActive: boolean;
    continentId: string;
    continent: Continent;
    projects: Project[];
    createdAt: Date;
    updatedAt: Date;
}
