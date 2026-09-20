import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { RequestWithUser } from '../decorators/current-user.decorator.js';
import { TokenService } from '../../modules/auth/token.service.js';

export const ACCESS_TOKEN_COOKIE = 'bmz_access';
export const REFRESH_TOKEN_COOKIE = 'bmz_refresh';

/**
 * Authenticates every request that is not explicitly public.
 *
 * The token is read from an httpOnly cookie first and from an Authorization
 * header second, so browsers never have to hold a token anywhere a script can
 * read it while server-to-server callers still have a way in.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Not signed in');
    }

    const payload = await this.tokens.verifyAccessToken(token);

    // A signed-out or revoked session must stop working immediately, not when
    // its access token happens to expire.
    if (!(await this.tokens.isSessionActive(payload.sid))) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    request.user = { id: payload.sub, email: payload.email, sessionId: payload.sid };
    return true;
  }

  private extractToken(request: RequestWithUser): string | null {
    const cookies = request.cookies as Record<string, string> | undefined;
    const fromCookie = cookies?.[ACCESS_TOKEN_COOKIE];
    if (fromCookie) return fromCookie;

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);

    return null;
  }
}
