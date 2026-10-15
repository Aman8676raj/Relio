import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PrismaService } from '../prisma';

/**
 * Guard that enforces organization-level RBAC.
 *
 * Behavior:
 * - If route is @Public(), skip entirely.
 * - If route has no @Roles() decorator, skip (backwards compatible).
 * - If route has @Roles('owner', 'contributor'), verify the user belongs
 *   to an org with one of those roles.
 * - If route has @Roles() with empty array, any org member passes.
 * - If user has no org membership at all, lazily provision one, then re-check.
 *
 * Registered as a global guard in AppModule (runs after JwtAuthGuard).
 */
@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Check if @Roles() is applied
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator → no RBAC check (backwards compatible)
    if (requiredRoles === undefined) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) return false;

    // Look up user's org membership
    let membership = await this.prisma.orgMember.findFirst({
      where: { userId: user.id },
      select: { role: true },
    });

    // No org membership — lazily provision org + owner membership
    if (!membership) {
      // If roles array is empty (@Roles()), any authenticated user is fine
      // since they may not have created an org yet
      if (requiredRoles.length === 0) return true;

      // Auto-provision org + owner for existing users who slipped through
      try {
        const displayName = user.name || user.email || 'My Org';
        const baseSlug = displayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 80) || 'my-org';
        const slug = `${baseSlug}-${Date.now().toString(36)}`;

        const org = await this.prisma.organization.create({
          data: {
            name: `${displayName}'s Workspace`,
            slug,
          },
        });

        membership = await this.prisma.orgMember.create({
          data: {
            orgId: org.id,
            userId: user.id,
            role: 'owner',
          },
          select: { role: true },
        });
      } catch {
        throw new ForbiddenException(
          'You must be a member of an organization to perform this action',
        );
      }
    }

    // Empty roles array = any org member
    if (requiredRoles.length === 0) return true;

    // Check specific role
    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `This action requires one of: ${requiredRoles.join(', ')}. Your role: ${membership.role}`,
      );
    }

    return true;
  }
}
