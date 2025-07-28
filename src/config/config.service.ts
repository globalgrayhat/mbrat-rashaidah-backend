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
    const api = `http://${this.apiDomain}`;

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
    return this.configService.getOrThrow<string>('TYPE_DATABASE') || '';
  }
  /** host */
  get hostDatabase(): string {
    return this.configService.getOrThrow<string>('HOST_DATABASE') || '';
  }

  /** port */
  get portDatabase(): number {
    return this.configService.getOrThrow<number>('PORT_DATABASE') || 3306;
  }

  /** username */
  get userDatabase(): string {
    return this.configService.getOrThrow<string>('USER_DATABASE') || '';
  }

  /** password */
  get passwordDatabase(): string {
    return this.configService.getOrThrow<string>('PASSWORD_DATABASE') || '';
  }

  /** database name */
  get nameDatabase(): string {
    return this.configService.getOrThrow<string>('NAME_DATABASE') || '';
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
    return this.configService.getOrThrow<string>('MAIL_HOST', '');
  }

  /** SMTP mail port (default is 465) */
  get mailPort(): number {
    return Number(this.configService.getOrThrow<number>('MAIL_PORT', 465));
  }

  /** Mail secure protocol (e.g., SSL or TLS) */
  get mailSecure(): string {
    return this.configService.getOrThrow<string>('MAIL_SECURE', 'SSL');
  }

  /** Mail server username */
  get mailUser(): string {
    return this.configService.getOrThrow<string>('MAIL_USER', '');
  }

  /** Mail server password */
  get mailPass(): string {
    return this.configService.getOrThrow<string>('MAIL_PASS', '');
  }

  /** Sender email address */
  get mailFrom(): string {
    return this.configService.getOrThrow<string>('MAIL_FROM', '');
  }

  /** Sender name displayed in emails */
  get mailFromName(): string {
    return this.configService.getOrThrow<string>('MAIL_FROM_NAME', 'No‑Reply');
  }

  /** ==================== Myfatoorah Configuration ==================== */
  get myFatoorahApiKey(): string {
    return this.configService.getOrThrow<string>('MYFATOORAH_API_KEY') || '';
  }

  get myFatoorahApiUrl(): string {
    return (
      this.configService.getOrThrow<string>('MYFATOORAH_API_URL') ||
      'https://apitest.myfatoorah.com/v2/'
    );
  }
  get myFatoorahCallbackUrl(): string {
    return (
      this.configService.getOrThrow<string>('MYFATOORAH_CALLBACK_URL') || ''
    );
  }
  get myFatoorahErrorkUrl(): string {
    return this.configService.getOrThrow<string>('MYFATOORAH_ERROR_URL') || '';
  }

  get myFatoorahTz(): string {
    const tz = this.configService.getOrThrow<string>('MYFATOORAH_TZ');
    return tz && tz.trim() ? tz : 'Asia/Kuwait';
  }

  get myFatoorahInvoiceTtlMinutes(): number | undefined {
    const v = this.configService.getOrThrow<string>(
      'MYFATOORAH_INVOICE_TTL_MINUTES',
    );
    if (v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  get myFatoorahTtlSkewSeconds(): number {
    const v = this.configService.getOrThrow<string>(
      'MYFATOORAH_TTL_SKEW_SECONDS',
    );
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 30;
  }
}
