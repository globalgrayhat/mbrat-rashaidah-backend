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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiOperation({ summary: 'Verify OTP for registration or login' })
  @Public()
  @Post('otp-verify')
  verify(@Body() dto: OtpVerifyDto) {
    if (!dto.email || !dto.otp) {
      throw new BadRequestException('Email or OTP is missing');
    }
    return this.auth.verifyOtp(dto.email, dto.otp);
  }

  @ApiOperation({ summary: 'Refresh access token' })
  @UseGuards(AuthGuard('refresh'))
  @Post('refresh')
  refresh(@Req() req: { user: JwtPayload & { refreshToken: string } }) {
    const user = req.user;
    if (!user?.refreshToken) {
      throw new BadRequestException('Refresh token is missing');
    }
    return this.auth.refreshToken(user.refreshToken);
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Request() req: { user: JwtPayload }) {
    return req.user;
  }
}
