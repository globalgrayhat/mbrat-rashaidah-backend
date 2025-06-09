"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const user_service_1 = require("../user/user.service");
const config_service_1 = require("../config/config.service");
const otp_service_1 = require("../common/otp/otp.service");
let AuthService = class AuthService {
    usersService;
    jwtService;
    configService;
    otpService;
    constructor(usersService, jwtService, configService, otpService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.otpService = otpService;
    }
    async register(email, password) {
        const existingUser = await this.usersService.findByEmail(email);
        if (existingUser) {
            if (!existingUser.isVerified && this.configService.otpEnabled) {
                await this.otpService.createAndSend(email);
                return { status: 'OTP_RESENT' };
            }
            throw new common_1.ConflictException('User already registered');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const createdUser = await this.usersService.create({
            email,
            password: hashedPassword,
        });
        if (this.configService.otpEnabled) {
            await this.otpService.createAndSend(email);
            return { status: 'OTP_SENT' };
        }
        return this.issueTokens(createdUser);
    }
    async validateUser(email, password) {
        const user = await this.usersService.findByEmail(email);
        if (!user)
            throw new common_1.UnauthorizedException('Invalid email');
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid)
            throw new common_1.UnauthorizedException('Invalid password');
        return user;
    }
    async login(loginDto) {
        const user = await this.validateUser(loginDto.email, loginDto.password);
        if (this.configService.otpEnabled) {
            await this.otpService.createAndSend(user.email);
            return { status: 'OTP_REQUIRED' };
        }
        return this.issueTokens(user);
    }
    async verifyOtp(email, otpCode) {
        await this.otpService.verify(email, otpCode);
        const user = await this.usersService.findByEmail(email);
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        return this.issueTokens(user);
    }
    async refreshToken(refreshToken) {
        const payload = this.jwtService.verify(refreshToken, {
            secret: this.configService.jwtRefreshTokenSecret,
        });
        const user = await this.usersService.findOne(payload.sub);
        if (user.refreshToken !== refreshToken)
            throw new common_1.UnauthorizedException();
        return this.issueTokens(user);
    }
    async issueTokens(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };
        const access_token = this.jwtService.sign(payload, {
            secret: this.configService.jwtAccessTokenSecret,
            expiresIn: this.configService.jwtAccessTokenExpiresIn,
        });
        const refresh_token = this.jwtService.sign(payload, {
            secret: this.configService.jwtRefreshTokenSecret,
            expiresIn: this.configService.jwtRefreshTokenExpiresIn,
        });
        await this.usersService.update(user.id, { refreshToken: refresh_token });
        return { access_token, refresh_token };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UsersService,
        jwt_1.JwtService,
        config_service_1.AppConfigService,
        otp_service_1.OtpService])
], AuthService);
//# sourceMappingURL=auth.service.js.map