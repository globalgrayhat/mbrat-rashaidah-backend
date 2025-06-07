import { AppConfigService } from '../../config/config.service';
import { UsersService } from '../../user/user.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
declare const JwtStrategy_base: new (...args: any) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    private configService;
    private usersService;
    constructor(configService: AppConfigService, usersService: UsersService);
    validate(payload: JwtPayload): Promise<{
        userId: string;
        email: string;
        role: import("../constants/roles.constant").Role;
    }>;
}
export {};
