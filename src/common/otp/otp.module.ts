import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { UserModule } from '../../user/user.module';
import { MailModule } from '../mail/mail.module';
import { AppConfigModule } from '../../config/config.module';

@Module({
  imports: [UserModule, MailModule, AppConfigModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
