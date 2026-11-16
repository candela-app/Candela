import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { User } from '../entities/user.entity';

/**
 * Wave 0 / Phase 1: organisation scoping for hospital admins.
 * Super admins are not org-scoped.
 * After memberships ship, callers should prefer active membership checks;
 * until then, use users.organization_id as the interim org reference.
 */
export function assertSuperAdminOrOrgAdmin(actor: User): void {
  if (actor.role !== 'super_admin' && actor.role !== 'admin') {
    throw new ForbiddenException('Administrator access required');
  }
}

/** Returns null for super_admin (all orgs). Throws if org admin has no organisation. */
export function adminOrganizationScope(actor: User): string | null {
  if (actor.role === 'super_admin') {
    return null;
  }
  if (actor.role !== 'admin') {
    throw new ForbiddenException('Administrator access required');
  }
  if (!actor.organizationId) {
    throw new UnauthorizedException('Administrator is not assigned to an organisation');
  }
  return actor.organizationId;
}

export function assertSameOrganization(
  actor: User,
  resourceOrganizationId: string | null | undefined,
  message = 'You cannot manage records outside your organisation',
): void {
  const scope = adminOrganizationScope(actor);
  if (scope === null) {
    return;
  }
  if (!resourceOrganizationId || resourceOrganizationId !== scope) {
    throw new ForbiddenException(message);
  }
}
