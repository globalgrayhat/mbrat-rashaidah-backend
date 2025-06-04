import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../user/user.service';
import { AppConfigService } from '../config/config.service';
import { LoginDto } from './dto/login.dto';
import { User } from '../user/entities/user.entity';
import { OtpService } from '../common/otp/otp.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigService,
    private readonly otpService: OtpService,
  ) {}

  async register(email: string, password: string) {
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      if (!existingUser.isVerified && this.configService.otpEnabled) {
        await this.otpService.createAndSend(email);
        return { status: 'OTP_RESENT' } as const;
      }
      throw new ConflictException('User already registered');
    }

    const hashedPassword: string = await bcrypt.hash(password, 10);
    const createdUser = await this.usersService.create({
      email,
      password: hashedPassword,
    });

    if (this.configService.otpEnabled) {
      await this.otpService.createAndSend(email);
      return { status: 'OTP_SENT' } as const;
    }

    return this.issueTokens(createdUser);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email');
    const isPasswordValid: boolean = await bcrypt.compare(
      password,
      user.password,
    );
    if (!isPasswordValid) throw new UnauthorizedException('Invalid password');
    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (this.configService.otpEnabled) {
      await this.otpService.createAndSend(user.email);
      return { status: 'OTP_REQUIRED' } as const;
    }
    return this.issueTokens(user);
  }

  async verifyOtp(email: string, otpCode: string) {
    await this.otpService.verify(email, otpCode);
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('User not found');
    return this.issueTokens(user);
  }

  async refreshToken(refreshToken: string) {
    const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
      secret: this.configService.jwtRefreshTokenSecret,
    });

    const user = await this.usersService.findOne(payload.sub);
    if (user.refreshToken !== refreshToken) throw new UnauthorizedException();
    return this.issueTokens(user);
  }

  private async issueTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    } as const;

    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.jwtAccessTokenSecret,
      expiresIn: this.configService.jwtAccessTokenExpiresIn,
    });

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.jwtRefreshTokenSecret,
      expiresIn: this.configService.jwtRefreshTokenExpiresIn,
    });

    await this.usersService.update(user.id, { refreshToken: refresh_token });
    return { access_token, refresh_token } as const;
  }
}
