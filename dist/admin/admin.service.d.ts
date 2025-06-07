import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Role } from '../common/constants/roles.constant';
export declare class AdminService {
    private readonly repo;
    constructor(repo: Repository<User>);
    findAll(): Promise<User[]>;
    findOne(id: string): Promise<User>;
    updateRole(id: string, role: Role): Promise<User>;
    deleteUser(id: string): Promise<void>;
}
