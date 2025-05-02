import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Centralized configuration service to access environment variables
 */
@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  /** ==================== Database Configuration ==================== */

  /** PostgreSQL host */
  get postgresHost(): string {
    return this.configService.get<string>('POSTGRES_HOST') || '';
  }

  /** PostgreSQL port */
  get postgresPort(): number {
    return this.configService.get<number>('POSTGRES_PORT') || 5432;
  }

  /** PostgreSQL username */
  get postgresUser(): string {
    return this.configService.get<string>('POSTGRES_USER') || '';
  }

  /** PostgreSQL password */
  get postgresPassword(): string {
    return this.configService.get<string>('POSTGRES_PASSWORD') || '';
  }

  /** PostgreSQL database name */
  get postgresDatabase(): string {
    return this.configService.get<string>('POSTGRES_DB') || '';
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
