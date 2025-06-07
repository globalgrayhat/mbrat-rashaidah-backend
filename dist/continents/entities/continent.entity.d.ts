import { Country } from '../../countries/entities/country.entity';
export declare class Continent {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    countries: Country[];
    createdAt: Date;
    updatedAt: Date;
}
