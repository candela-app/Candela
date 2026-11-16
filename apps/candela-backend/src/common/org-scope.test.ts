import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { User } from '../entities/user.entity';
import { adminOrganizationScope, assertSameOrganization, assertSuperAdminOrOrgAdmin } from './org-scope';

function user(partial: Partial<User>): User {
  return {
    id: 'u1',
    email: 'a@example.com',
    passwordHash: null,
    name: 'A',
    phone: null,
    googleId: null,
    role: 'admin',
    organizationId: 'org-a',
    createdAt: new Date(),
    ...partial,
  } as User;
}

describe('org-scope', () => {
  it('allows super_admin across organisations', () => {
    const actor = user({ role: 'super_admin', organizationId: null });
    expect(adminOrganizationScope(actor)).toBeNull();
    expect(() => assertSameOrganization(actor, 'org-b')).not.toThrow();
  });

  it('scopes hospital admin to their organisation', () => {
    const actor = user({ role: 'admin', organizationId: 'org-a' });
    expect(adminOrganizationScope(actor)).toBe('org-a');
    expect(() => assertSameOrganization(actor, 'org-a')).not.toThrow();
    expect(() => assertSameOrganization(actor, 'org-b')).toThrow(ForbiddenException);
    expect(() => assertSameOrganization(actor, null)).toThrow(ForbiddenException);
  });

  it('rejects org admin without organisation', () => {
    const actor = user({ role: 'admin', organizationId: null });
    expect(() => adminOrganizationScope(actor)).toThrow(UnauthorizedException);
  });

  it('rejects non-admin roles', () => {
    expect(() => assertSuperAdminOrOrgAdmin(user({ role: 'doctor' }))).toThrow(ForbiddenException);
    expect(() => assertSuperAdminOrOrgAdmin(user({ role: 'patient' }))).toThrow(ForbiddenException);
  });
});
