import { SetMetadata } from '@nestjs/common';
import type { MembershipRole } from '../../generated/prisma/client.js';

export const ROLES_KEY = 'bmz:roles';

/** Restricts a route to members holding one of the listed workspace roles. */
export const Roles = (...roles: MembershipRole[]) => SetMetadata(ROLES_KEY, roles);
