import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Centralized configuration service to access environment variables
 */
@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  /** ==================== App Config ==================== */

  /** Application name */
  get appName(): string {
    return this.configService.get<string>('APP_NAME') ?? 'GlobalGrayHat';
  }

  /** Application port */
  get port(): number {
    return Number(this.configService.get<string>('PORT') ?? 3000);
  }

  /** The main domain (e.g. example.com) */
  get baseDomain(): string {
    return this.configService.get<string>('BASE_DOMAIN') ?? 'localhost';
  }

  /** The subdomain used for API (e.g. api.example.com) */
  get apiDomain(): string {
    return (
      this.configService.get<string>('API_DOMAIN') ?? `api.${this.baseDomain}`
    );
  }

  /** Allowed CORS origins (comma separated) */
  get allowedOrigins(): string[] {
    // Get raw origins string from environment
    const rawOrigins = this.configService.get<string>('ALLOWED_ORIGINS');

    // Split and trim the origins if defined, otherwise start with an empty array
    const origins = rawOrigins
      ? rawOrigins.split(',').map((origin) => origin.trim())
      : [];

    // Compose default domains
    const base = `https://${this.baseDomain}`;
    const api = `https://${this.apiDomain}`;

    // Add base domain if it's not already included
    if (!origins.includes(base)) {
      origins.push(base);
    }

    // Add API domain if it's not already included
    if (!origins.includes(api)) {
      origins.push(api);
    }

    return origins;
  }

  /** ==================== Environment ==================== */

  /** Check if running in development environment */
  get isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'development';
  }

  /** Check if running in testing environment */
  get isTest(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'test';
  }

  /** Check if running in production environment */
  get isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  /** ==================== Database Configuration ==================== */

  /** host */
  get typeDatabase(): string {
    return this.configService.get<string>('TYPE') || '';
  }
  /** host */
  get hostDatabase(): string {
    return this.configService.get<string>('HOST') || '';
  }

  /** port */
  get portDatabase(): number {
    return this.configService.get<number>('PORT_DATABASE') || 3306;
  }

  /** username */
  get userDatabase(): string {
    return this.configService.get<string>('USER') || '';
  }

  /** password */
  get passwordDatabase(): string {
    return this.configService.get<string>('PASSWORD') || '';
  }

  /** database name */
  get nameDatabase(): string {
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

  /** Set time to OTP */
  get otpExpiresIn(): number {
    return this.configService.get<number>('EXP_MINUTES', 1);
  }
  /** Set length to OTP */
  get otpLength(): number {
    return this.configService.get<number>('OTP_LENGTH', 6);
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
