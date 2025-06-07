import { UsersService } from './user.service';
export declare class UsersController {
    private us;
    constructor(us: UsersService);
    create(dto: any): Promise<import("./entities/user.entity").User>;
    findAll(): Promise<import("./entities/user.entity").User[]>;
    findOne(id: string): Promise<import("./entities/user.entity").User>;
    update(id: string, dto: any): Promise<import("./entities/user.entity").User>;
    remove(id: string): Promise<void>;
}
