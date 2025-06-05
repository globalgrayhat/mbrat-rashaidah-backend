import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigService } from '../config/config.service';
import { AppConfigModule } from '../config/config.module';
import { JwtStrategy } from '../common/strategies/jwt.strategy';
import { RefreshTokenStrategy } from '../common/strategies/refresh-token.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpModule } from '../common/otp/otp.module';
import { UserModule } from '../user/user.module';
import { OtpService } from '../common/otp/otp.service';
import { MailModule } from '../common/mail/mail.module';
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: (configService: AppConfigService) => ({
        secret: configService.jwtAccessTokenSecret,
        signOptions: {
          expiresIn: configService.jwtAccessTokenExpiresIn,
        },
      }),
      inject: [AppConfigService],
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
