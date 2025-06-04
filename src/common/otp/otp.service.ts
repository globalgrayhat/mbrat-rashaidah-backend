import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../user/user.service';
import { generateOTP } from '../../common/utils/otp-generator.util';
import { MailService } from '../../common/mail/mail.service';
import { AppConfigService } from '../../config/config.service';

@Injectable()
export class OtpService {
  constructor(
    private readonly userService: UsersService,
    private readonly mailService: MailService,
    private readonly cfg: AppConfigService,
  ) {}

  /**
   * Generates an OTP, stores it on the user, and sends via e‑mail.
   */
  async createAndSend(email: string): Promise<void> {
    if (!this.cfg.otpEnabled) return;
    const EXP_MINUTES = this.cfg.otpExpiresIn;
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + EXP_MINUTES * 60_000);
    await this.userService.updateByEmail(email, { otp, otpExpires });

    await this.mailService.sendMail(
      email,
      'One‑Time Password',
      `OTP: ${otp}\n\nExpires in ${EXP_MINUTES} minutes.`,
    );
  }

  /**
   * Validates a submitted OTP.
   */
  async verify(email: string, otp: string): Promise<void> {
    const user = await this.userService.findByEmail(email);

    const invalid =
      !user ||
      user.otp !== otp ||
      !user.otpExpires ||
      user.otpExpires < new Date();

    if (invalid)
      throw new UnauthorizedException(
        'Invalid or expired OTP. Please try again.',
      );

    await this.userService.update(user.id, {
      otp: undefined,
      otpExpires: undefined,
      isVerified: true,
    });
  }
}
