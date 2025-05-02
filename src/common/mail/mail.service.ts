import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppConfigService } from '../../config/config.service';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: AppConfigService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.transporter = nodemailer.createTransport({
      host: this.configService.mailHost,
      port: this.configService.mailPort,
      secure: this.configService.mailSecure,
      auth: {
        user: this.configService.mailUser,
        pass: this.configService.mailPass,
      },
    });
  }

  async sendMail(to: string, subject: string, text: string) {
    const mailOptions = {
      from: `"${this.configService.mailFromName}" <${this.configService.mailFrom}>`,
      to,
      subject,
      text,
    };
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Mail send error:', error.message);
      } else {
        console.error('Unknown error during mail sending', error);
      }
      throw new InternalServerErrorException('Failed to send email');
    }
  }
}
