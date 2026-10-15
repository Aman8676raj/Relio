import { SetMetadata } from '@nestjs/common';

/**
 * Allowed org roles for a route. When applied to a controller method,
 * the OrgRolesGuard will verify the user is a member of an org with
 * one of the specified roles.
 *
 * Usage:
 *   @Roles('owner', 'contributor')  // only owners and contributors
 *   @Roles()                        // any org member (including viewer)
 *
 * If no @Roles() decorator is present, the guard does nothing (backwards
 * compatible with existing controllers that don't use RBAC).
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
