import { AdminService } from './admin.service';
import { Role } from '../common/constants/roles.constant';
declare class UpdateRoleDto {
    role: Role;
}
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    findAll(): Promise<import("../user/entities/user.entity").User[]>;
    findOne(id: string): Promise<import("../user/entities/user.entity").User>;
    updateRole(id: string, updateRoleDto: UpdateRoleDto): Promise<import("../user/entities/user.entity").User>;
    deleteUser(id: string): Promise<void>;
}
export {};
