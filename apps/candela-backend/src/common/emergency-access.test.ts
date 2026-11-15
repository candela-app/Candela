import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { requireEmergencyReason } from './emergency-access';
import type { User } from '../entities/user.entity';

function user(role: User['role']): User {
  return { id: 'u1', role, email: 'x@y.z', name: 'X', organizationId: 'org' } as User;
}

describe('requireEmergencyReason', () => {
  it('allows hospital admin without a reason', () => {
    expect(requireEmergencyReason(user('admin'), '')).toBe('');
  });

  it('rejects blank Super Admin reasons', () => {
    expect(() => requireEmergencyReason(user('super_admin'), '  ')).toThrow(BadRequestException);
  });

  it('accepts a valid Super Admin reason', () => {
    expect(requireEmergencyReason(user('super_admin'), 'Ownership repair for ticket 12')).toContain(
      'Ownership repair',
    );
  });
});
