import { Repository } from 'typeorm';
import { Country } from './entities/country.entity';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
export declare class CountriesService {
    private readonly countryRepository;
    constructor(countryRepository: Repository<Country>);
    create(dto: CreateCountryDto): Promise<Country>;
    findAll(): Promise<Country[]>;
    findOne(id: string): Promise<Country | null>;
    update(id: string, dto: UpdateCountryDto): Promise<Country>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
