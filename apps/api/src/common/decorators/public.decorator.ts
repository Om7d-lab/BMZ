import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'bmz:isPublic';

/**
 * Opts a route out of authentication. Authentication is global, so a route is
 * protected unless it says otherwise — the failure mode of forgetting this
 * decorator is a locked door, not an open one.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
