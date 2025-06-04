import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '../common/strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { AppConfigModule } from '../config/config.module';
import { OtpModule } from '../common/otp/otp.module';
import { OtpService } from '../common/otp/otp.service';
import { MailModule } from '../common/mail/mail.module';
import { RefreshTokenStrategy } from '../common/strategies/refresh-token.strategy';
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '1d',
        },
      }),
      inject: [ConfigService],
    }),
    UserModule,
    AppConfigModule,
    OtpModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenStrategy, OtpService],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
