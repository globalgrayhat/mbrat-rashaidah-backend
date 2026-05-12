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
    const otpLength = this.cfg.otpLength || 6;
    const otp = generateOTP(otpLength);
    const otpExpires = new Date(Date.now() + EXP_MINUTES * 60_000);
    await this.userService.updateByEmail(email, { otp, otpExpires });

    const textContent = `رمز التحقق الخاص بك في ${this.cfg.appName} هو: ${otp}
مدة صلاحية الرمز: ${EXP_MINUTES} دقيقة
إذا لم تكن أنت من طلب هذا الرمز، يرجى تجاهل هذه الرسالة`;

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>رمز التحقق</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f7fa;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 600;
            margin: 0;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            color: #333333;
            font-size: 16px;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        .otp-container {
            background-color: #f8f9ff;
            border: 2px dashed #667eea;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            margin: 24px 0;
        }
        .otp-label {
            color: #666666;
            font-size: 14px;
            margin-bottom: 12px;
        }
        .otp-code {
            font-size: 36px;
            font-weight: 700;
            color: #667eea;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            user-select: all;
            cursor: pointer;
        }
        .otp-code:hover {
            color: #764ba2;
        }
        .copy-hint {
            color: #999999;
            font-size: 12px;
            margin-top: 8px;
        }
        .expiry {
            background-color: #fff5f5;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            margin: 20px 0;
        }
        .expiry-text {
            color: #e53e3e;
            font-size: 14px;
            font-weight: 500;
        }
        .expiry-time {
            color: #e53e3e;
            font-size: 18px;
            font-weight: 700;
            margin-top: 4px;
        }
        .warning {
            background-color: #fffbeb;
            border-left: 4px solid #f6ad55;
            padding: 16px;
            border-radius: 0 8px 8px 0;
            margin-top: 20px;
        }
        .warning-text {
            color: #744210;
            font-size: 13px;
            line-height: 1.5;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        .footer-text {
            color: #718096;
            font-size: 12px;
        }
        .app-name {
            color: #667eea;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${this.cfg.appName}</h1>
        </div>
        <div class="content">
            <p class="greeting">
                السلام عليكم ورحمة الله وبركاته،<br>
                إليك رمز التحقق الخاص بك:
            </p>
            
            <div class="otp-container">
                <div class="otp-label">رمز التحقق (OTP)</div>
                <div class="otp-code" title="انقر للنسخ">${otp}</div>
            </div>
            
            <div class="expiry">
                <div class="expiry-text">مدة صلاحية الرمز</div>
                <div class="expiry-time">${EXP_MINUTES} دقيقة</div>
            </div>
            
            <div class="warning">
                <p class="warning-text">
                    ⚠️ إذا لم تكن أنت من طلب هذا الرمز، يرجى تجاهل هذه الرسالة.<br>
                    لا تشارك هذا الرمز مع أي شخص.
                </p>
            </div>
        </div>
        <div class="footer">
            <p class="footer-text">
                شكراً لاستخدامك خدمات <span class="app-name">${this.cfg.appName}</span>
            </p>
        </div>
    </div>
</body>
</html>`;

    await this.mailService.sendMail(
      email,
      `رمز التحقق - ${this.cfg.appName}`,
      textContent,
      htmlContent,
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
