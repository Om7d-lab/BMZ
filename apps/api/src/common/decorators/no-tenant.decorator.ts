import { SetMetadata } from '@nestjs/common';

export const NO_TENANT_KEY = 'bmz:noTenant';

/**
 * Opts a route out of workspace resolution.
 *
 * Tenancy is enforced globally, so a route is workspace-scoped unless it says
 * otherwise. This is for the handful of endpoints that are about the person
 * rather than one of their workspaces — signing in, reading the session,
 * editing a profile — and for nothing else.
 */
export const NoTenant = () => SetMetadata(NO_TENANT_KEY, true);
