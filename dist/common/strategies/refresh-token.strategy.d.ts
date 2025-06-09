import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AppConfigService } from '../../config/config.service';
declare const RefreshTokenStrategy_base: new (...args: any) => any;
export declare class RefreshTokenStrategy extends RefreshTokenStrategy_base {
    private readonly cfg;
    constructor(cfg: AppConfigService);
    validate(req: Request, payload: JwtPayload): {
        refreshToken: string;
        sub: string;
        email: string;
        role: string;
    };
}
export {};
