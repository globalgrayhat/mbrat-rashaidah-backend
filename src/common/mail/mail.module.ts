import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { AppConfigModule } from '../../config/config.module';

@Module({
  imports: [AppConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
