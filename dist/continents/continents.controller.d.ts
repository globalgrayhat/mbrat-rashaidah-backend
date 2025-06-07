import { ContinentsService } from './continents.service';
import { CreateContinentDto } from './dto/create-continent.dto';
import { UpdateContinentDto } from './dto/update-continent.dto';
export declare class ContinentsController {
    private readonly continentsService;
    constructor(continentsService: ContinentsService);
    create(createContinentDto: CreateContinentDto): Promise<import("./entities/continent.entity").Continent>;
    findAll(): Promise<import("./entities/continent.entity").Continent[]>;
    findOne(id: string): Promise<import("./entities/continent.entity").Continent | null>;
    update(id: string, updateContinentDto: UpdateContinentDto): Promise<import("typeorm").UpdateResult>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
