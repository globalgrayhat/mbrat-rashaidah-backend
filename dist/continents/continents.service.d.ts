import { DeleteResult, Repository, UpdateResult } from 'typeorm';
import { Continent } from './entities/continent.entity';
import { CreateContinentDto } from './dto/create-continent.dto';
import { UpdateContinentDto } from './dto/update-continent.dto';
export declare class ContinentsService {
    private continentRepository;
    constructor(continentRepository: Repository<Continent>);
    create(createContinentDto: CreateContinentDto): Promise<Continent>;
    findAll(): Promise<Continent[]>;
    findOne(id: string): Promise<Continent | null>;
    update(id: string, updateContinentDto: UpdateContinentDto): Promise<UpdateResult>;
    remove(id: string): Promise<DeleteResult>;
}
