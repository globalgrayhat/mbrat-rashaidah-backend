import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AppConfigService } from '../../config/config.service';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'refresh',
) {
  constructor(private readonly cfg: AppConfigService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request): string | null => {
          const raw = req.get('x-refresh-token');
          if (!raw?.startsWith('Bearer ')) return null;
          return raw.replace('Bearer ', '').trim();
        },
      ]),
      secretOrKey: cfg.jwtRefreshTokenSecret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload) {
    const token = req.get('x-refresh-token')?.replace('Bearer ', '').trim();

    if (!token) throw new Error('Refresh token is missing');

    return { ...payload, refreshToken: token };
  }
}
