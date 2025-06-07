import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    register(dto: RegisterDto): Promise<{
        readonly access_token: string;
        readonly refresh_token: string;
    } | {
        readonly status: "OTP_RESENT";
    } | {
        readonly status: "OTP_SENT";
    }>;
    login(dto: LoginDto): Promise<{
        readonly access_token: string;
        readonly refresh_token: string;
    } | {
        readonly status: "OTP_REQUIRED";
    }>;
    verify(dto: OtpVerifyDto): Promise<{
        readonly access_token: string;
        readonly refresh_token: string;
    }>;
    refresh(req: {
        user: JwtPayload & {
            refreshToken: string;
        };
    }): Promise<{
        readonly access_token: string;
        readonly refresh_token: string;
    }>;
    profile(req: {
        user: JwtPayload;
    }): JwtPayload;
}
