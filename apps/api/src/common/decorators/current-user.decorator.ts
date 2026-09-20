import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
  /** Set by TenantGuard once membership has been checked. */
  organizationId?: string;
  organizationRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithUser>();
  return request.user;
});
