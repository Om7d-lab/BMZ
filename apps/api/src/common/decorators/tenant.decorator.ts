import {
  createParamDecorator,
  InternalServerErrorException,
  type ExecutionContext,
} from '@nestjs/common';
import type { RequestWithUser } from './current-user.decorator.js';

/**
 * The workspace this request acts within, resolved and membership-checked by
 * TenantGuard.
 *
 * Every tenant-scoped query takes this id. Reading it through a decorator that
 * throws when it is absent means a controller cannot accidentally run a query
 * with an undefined workspace and return another trader's rows.
 */
export const Tenant = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<RequestWithUser>();

  if (!request.organizationId) {
    throw new InternalServerErrorException(
      'Tenant context is missing; this route needs the TenantGuard',
    );
  }

  return request.organizationId;
});
