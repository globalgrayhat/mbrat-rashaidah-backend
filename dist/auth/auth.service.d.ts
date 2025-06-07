import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../user/user.service';
import { AppConfigService } from '../config/config.service';
import { LoginDto } from './dto/login.dto';
import { User } from '../user/entities/user.entity';
import { OtpService } from '../common/otp/otp.service';
export declare class AuthService {
    private readonly usersService;
    private readonly jwtService;
    private readonly configService;
    private readonly otpService;
    constructor(usersService: UsersService, jwtService: JwtService, configService: AppConfigService, otpService: OtpService);
    register(email: string, password: string): Promise<{
        readonly access_token: string;
        readonly refresh_token: string;
    } | {
        readonly status: "OTP_RESENT";
    } | {
        readonly status: "OTP_SENT";
    }>;
    validateUser(email: string, password: string): Promise<User>;
    login(loginDto: LoginDto): Promise<{
        readonly access_token: string;
        readonly refresh_token: string;
    } | {
        readonly status: "OTP_REQUIRED";
    }>;
    verifyOtp(email: string, otpCode: string): Promise<{
        readonly access_token: string;
        readonly refresh_token: string;
    }>;
    refreshToken(refreshToken: string): Promise<{
        readonly access_token: string;
        readonly refresh_token: string;
    }>;
    private issueTokens;
}
