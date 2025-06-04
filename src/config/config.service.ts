import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Centralized configuration service to access environment variables
 */
@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  /** ==================== Database Configuration ==================== */

  /** host */
  get type(): string {
    return this.configService.get<string>('TYPE') || '';
  }
  /** host */
  get host(): string {
    return this.configService.get<string>('HOST') || '';
  }

  /** port */
  get port(): number {
    return this.configService.get<number>('PORT_DATABASE') || 5432;
  }

  /** username */
  get user(): string {
    return this.configService.get<string>('USER') || '';
  }

  /** password */
  get password(): string {
    return this.configService.get<string>('PASSWORD') || '';
  }

  /** database name */
  get database(): string {
    return this.configService.get<string>('DB') || '';
  }

  /** ==================== JWT Configuration ==================== */

  /** Access token secret key */
  get jwtAccessTokenSecret(): string {
    return this.configService.get<string>('JWT_ACCESS_SECRET') || '';
  }

  /** Access token expiration time (e.g., '1d', '15m') */
  get jwtAccessTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRATION') || '';
  }

  /** Refresh token secret key */
  get jwtRefreshTokenSecret(): string {
    return this.configService.get<string>('JWT_REFRESH_SECRET') || '';
  }

  /** Refresh token expiration time (e.g., '7d') */
  get jwtRefreshTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '';
  }

  /** ==================== OTP (One-Time Password) ==================== */

  /** Enable or disable OTP feature */
  get otpEnabled(): boolean {
    return this.configService.get<string>('OTP_ENABLED', 'false') === 'true';
  }
  /** Enable or disable OTP feature */
  get otpExpiresIn(): number {
    return this.configService.get<number>('EXP_MINUTES', 1);
  }

  /** ==================== Mail Server Configuration ==================== */

  /** SMTP mail host */
  get mailHost(): string {
    return this.configService.get<string>('MAIL_HOST', '');
  }

  /** SMTP mail port (default is 465) */
  get mailPort(): number {
    return Number(this.configService.get<number>('MAIL_PORT', 465));
  }

  /** Mail secure protocol (e.g., SSL or TLS) */
  get mailSecure(): string {
    return this.configService.get<string>('MAIL_SECURE', 'SSL');
  }

  /** Mail server username */
  get mailUser(): string {
    return this.configService.get<string>('MAIL_USER', '');
  }

  /** Mail server password */
  get mailPass(): string {
    return this.configService.get<string>('MAIL_PASS', '');
  }

  /** Sender email address */
  get mailFrom(): string {
    return this.configService.get<string>('MAIL_FROM', '');
  }

  /** Sender name displayed in emails */
  get mailFromName(): string {
    return this.configService.get<string>('MAIL_FROM_NAME', 'No‑Reply');
  }
}
