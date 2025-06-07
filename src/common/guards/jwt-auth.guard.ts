/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Try to authenticate with JWT
    try {
      return (await super.canActivate(context)) as boolean;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      // If JWT authentication fails, just return true for now
      // We'll handle guest tokens in a different way
      return true;
    }
  }
}
