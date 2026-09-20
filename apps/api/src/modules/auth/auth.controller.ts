import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  changePasswordRequest,
  loginRequest,
  registerRequest,
  requestPasswordResetRequest,
  resetPasswordRequest,
  sessionResponse,
  updateProfileRequest,
  userProfile,
  verifyEmailRequest,
  type SessionResponse,
  type UserProfile,
} from '@bmz/contracts';
import { AuthService } from './auth.service.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { NoTenant } from '../../common/decorators/no-tenant.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../common/guards/jwt-auth.guard.js';
import { ApiZodBody, ApiZodResponse } from '../../common/swagger/zod-openapi.js';
import type { IssuedTokens } from './token.service.js';

@ApiTags('auth')
// These routes are about the person, not one of their workspaces.
@NoTenant()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  // Registration is rate limited per IP: a handful of accounts is normal, a
  // hundred is a script.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Create an account and its first workspace' })
  @ApiZodBody(registerRequest)
  @ApiZodResponse(201, sessionResponse)
  async register(
    @Body(zodBody(registerRequest)) body: ReturnType<typeof registerRequest.parse>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const result = await this.auth.register(body, deviceContext(request));
    this.setAuthCookies(response, result.tokens);
    return result.session;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with an email and password' })
  @ApiZodBody(loginRequest)
  @ApiZodResponse(200, sessionResponse)
  async login(
    @Body(zodBody(loginRequest)) body: ReturnType<typeof loginRequest.parse>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const result = await this.auth.login(body, deviceContext(request));
    this.setAuthCookies(response, result.tokens);
    return result.session;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and mint a new access token' })
  @ApiZodResponse(200, sessionResponse)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const cookies = request.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      throw new UnauthorizedException('No session to refresh');
    }

    try {
      const result = await this.auth.refresh(refreshToken, deviceContext(request));
      this.setAuthCookies(response, result.tokens);
      return result.session;
    } catch (error) {
      // A dead session should leave the browser with no cookies at all, so the
      // client stops retrying and shows the sign-in screen.
      this.clearAuthCookies(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out of this session' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookies = request.cookies as Record<string, string> | undefined;
    await this.auth.logout(cookies?.[REFRESH_TOKEN_COOKIE], user.sessionId);
    this.clearAuthCookies(response);
  }

  @Get('session')
  @ApiOperation({ summary: 'The signed-in user and the workspaces they belong to' })
  @ApiZodResponse(200, sessionResponse)
  async session(@CurrentUser() user: AuthenticatedUser): Promise<SessionResponse> {
    // The cookie's own expiry is authoritative; this is what the client uses to
    // schedule its next refresh.
    return this.auth.buildSession(user.id, new Date(Date.now() + 15 * 60 * 1000));
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update display name, locale, timezone or currency' })
  @ApiZodBody(updateProfileRequest)
  @ApiZodResponse(200, userProfile)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodBody(updateProfileRequest)) body: ReturnType<typeof updateProfileRequest.parse>,
  ): Promise<UserProfile> {
    return this.auth.updateProfile(user.id, body);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change the password and sign out every other session' })
  @ApiZodBody(changePasswordRequest)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodBody(changePasswordRequest)) body: ReturnType<typeof changePasswordRequest.parse>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.changePassword(user.id, body.currentPassword, body.newPassword);
    this.clearAuthCookies(response);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start a password reset',
    description:
      'Always returns 202, whether or not the address is registered, so this endpoint cannot be used to discover which emails have accounts.',
  })
  @ApiZodBody(requestPasswordResetRequest)
  async requestPasswordReset(
    @Body(zodBody(requestPasswordResetRequest))
    body: ReturnType<typeof requestPasswordResetRequest.parse>,
  ): Promise<{ accepted: true; token?: string }> {
    const { token } = await this.auth.requestPasswordReset(body.email);

    // Outside production there is no mail server, so the token comes back in
    // the response to keep the flow testable end to end.
    if (token && this.config.get<string>('NODE_ENV') !== 'production') {
      return { accepted: true, token };
    }

    return { accepted: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiZodBody(resetPasswordRequest)
  async resetPassword(
    @Body(zodBody(resetPasswordRequest)) body: ReturnType<typeof resetPasswordRequest.parse>,
  ): Promise<void> {
    await this.auth.resetPassword(body.token, body.password);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm an email address' })
  @ApiZodBody(verifyEmailRequest)
  async verifyEmail(
    @Body(zodBody(verifyEmailRequest)) body: ReturnType<typeof verifyEmailRequest.parse>,
  ): Promise<void> {
    await this.auth.verifyEmail(body.token);
  }

  private setAuthCookies(response: Response, tokens: IssuedTokens): void {
    const secure = this.config.get<boolean>('AUTH_COOKIE_SECURE') ?? false;
    const domain = this.config.get<string>('AUTH_COOKIE_DOMAIN');

    const base = {
      httpOnly: true,
      secure,
      // "lax" still sends the cookie on a top-level navigation back from an
      // email link, which "strict" would drop.
      sameSite: 'lax' as const,
      path: '/',
      ...(domain ? { domain } : {}),
    };

    response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...base,
      expires: tokens.accessTokenExpiresAt,
    });

    response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...base,
      expires: tokens.refreshTokenExpiresAt,
    });
  }

  private clearAuthCookies(response: Response): void {
    const domain = this.config.get<string>('AUTH_COOKIE_DOMAIN');
    const options = { path: '/', ...(domain ? { domain } : {}) };
    response.clearCookie(ACCESS_TOKEN_COOKIE, options);
    response.clearCookie(REFRESH_TOKEN_COOKIE, options);
  }
}

function deviceContext(request: Request): { userAgent: string | null; ipAddress: string | null } {
  return {
    userAgent: request.headers['user-agent'] ?? null,
    ipAddress: request.ip ?? null,
  };
}
