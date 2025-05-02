import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('otp-verify')
  verify(@Body() dto: OtpVerifyDto) {
    if (!dto.email || !dto.otp) {
      throw new BadRequestException('Email or OTP is missing');
    }
    return this.auth.verifyOtp(dto.email, dto.otp);
  }

  @UseGuards(AuthGuard('refresh'))
  @Post('refresh')
  refresh(@Req() req: { user: JwtPayload & { refreshToken: string } }) {
    const user = req.user;
    if (!user?.refreshToken) {
      throw new BadRequestException('Refresh token is missing');
    }
    return this.auth.refreshToken(user.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Request() req: { user: JwtPayload }) {
    return req.user;
  }
}
