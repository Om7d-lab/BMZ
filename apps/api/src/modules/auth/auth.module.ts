import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { GoogleAuthController } from './google/google-auth.controller.js';
import { GoogleOidcService } from './google/google-oidc.service.js';
import { OAuthStateService } from './google/oauth-state.js';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, GoogleAuthController],
  providers: [AuthService, PasswordService, TokenService, GoogleOidcService, OAuthStateService],
  // TokenService is exported because the global JwtAuthGuard depends on it.
  exports: [AuthService, PasswordService, TokenService],
})
export class AuthModule {}
