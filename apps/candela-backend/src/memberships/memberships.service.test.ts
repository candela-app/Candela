import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource, Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import { DoctorOrganizationInvitation } from '../entities/doctor-organization-invitation.entity';
import { DoctorOrganizationMembership } from '../entities/doctor-organization-membership.entity';
import type { DoctorProfile } from '../entities/doctor-profile.entity';
import type { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import type { MailService } from '../mail/mail.service';
import { MembershipsService } from './memberships.service';
import { readOrganizationScopeHeader, requireOrganizationScopeHeader } from './organization-scope';
import type { Request } from 'express';

function admin(orgId: string): User {
  return {
    id: 'admin-1',
    role: 'admin',
    organizationId: orgId,
    email: 'a@example.com',
    name: 'Admin',
    phone: null,
    passwordHash: 'x',
    googleId: null,
    createdAt: new Date(),
  } as User;
}

function membership(partial: Partial<DoctorOrganizationMembership>): DoctorOrganizationMembership {
  return {
    id: 'm1',
    doctorId: 'doctor-1',
    organizationId: 'org-a',
    membershipStatus: 'active',
    isPrimary: true,
    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    endedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: { id: 'org-a', name: 'Org A', code: 'A' } as Organization,
    ...partial,
  } as DoctorOrganizationMembership;
}

function serviceFor(membershipsRepo: Partial<Repository<DoctorOrganizationMembership>>) {
  return new MembershipsService(
    membershipsRepo as Repository<DoctorOrganizationMembership>,
    {} as Repository<DoctorOrganizationInvitation>,
    {} as Repository<DoctorProfile>,
    {} as Repository<Organization>,
    {} as Repository<User>,
    {} as Repository<import('../entities/patient-profile.entity').PatientProfile>,
    {
      transaction: async (fn: (m: unknown) => Promise<unknown>) =>
        fn({
          getRepository: () => membershipsRepo,
        }),
    } as unknown as DataSource,
    { send: async () => false } as unknown as MailService,
    { get: () => undefined } as unknown as ConfigService,
  );
}

describe('MembershipsService + org header', () => {
  it('lists doctor organisations from memberships', async () => {
    const service = serviceFor({
      find: async () => [
        membership({ organizationId: 'org-a', isPrimary: true }),
        membership({
          id: 'm2',
          organizationId: 'org-b',
          isPrimary: false,
          organization: { id: 'org-b', name: 'Org B', code: 'B' } as Organization,
        }),
      ],
    });
    const rows = await service.listMyOrganizations('doctor-1');
    expect(rows).toHaveLength(2);
    expect(rows[0].organizationId).toBe('org-a');
    expect(rows[0].isPrimary).toBe(true);
  });

  it('assertActiveMembership rejects missing membership', async () => {
    const service = serviceFor({
      findOne: async () => null,
    });
    await expect(service.assertActiveMembership('doctor-1', 'org-x')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('assertActiveMembership accepts active membership', async () => {
    const service = serviceFor({
      findOne: async () => membership({}),
    });
    const row = await service.assertActiveMembership('doctor-1', 'org-a');
    expect(row.organizationId).toBe('org-a');
  });

  it('admin cannot list memberships for another organisation', async () => {
    const service = serviceFor({});
    await expect(service.listOrganizationMemberships(admin('org-a'), 'org-b')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('assertAdminManagesDoctor denies doctors outside admin organisation membership', async () => {
    const service = serviceFor({
      findOne: async () => null,
    });
    await expect(service.assertAdminManagesDoctor(admin('org-a'), 'doctor-other')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('ending membership does not invent patient reassignment (status only)', async () => {
    const row = membership({});
    const saved: DoctorOrganizationMembership[] = [];
    const service = new MembershipsService(
      {
        findOne: async () => row,
      } as unknown as Repository<DoctorOrganizationMembership>,
      {} as Repository<DoctorOrganizationInvitation>,
      {} as Repository<DoctorProfile>,
      {} as Repository<Organization>,
      {} as Repository<User>,
      {} as Repository<import('../entities/patient-profile.entity').PatientProfile>,
      {
        transaction: async (fn: (manager: {
          getRepository: (entity: unknown) => {
            findOne: typeof Object;
            save: typeof Object;
            count: typeof Object;
          };
        }) => Promise<unknown>) =>
          fn({
            getRepository: () => ({
              findOne: async () => row,
              save: async (m: DoctorOrganizationMembership) => {
                saved.push({ ...m });
                Object.assign(row, m);
                return m;
              },
              count: async () => 0,
              update: async () => undefined,
            }),
          }),
      } as unknown as DataSource,
      { send: async () => false } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
    );

    const result = await service.updateMembershipStatus(admin('org-a'), 'org-a', 'doctor-1', {
      status: 'ended',
    });
    expect(result.membershipStatus).toBe('ended');
    expect(result.endedAt).toBeTruthy();
    expect(result.isPrimary).toBe(false);
    // No patient repository interaction — ownership untouched.
  });

  it('requires valid X-Organization-Id header', () => {
    expect(() =>
      requireOrganizationScopeHeader({ headers: {} } as Request),
    ).toThrow(BadRequestException);
    expect(() =>
      requireOrganizationScopeHeader({ headers: { 'x-organization-id': 'not-a-uuid' } } as Request),
    ).toThrow(BadRequestException);
    const id = readOrganizationScopeHeader({
      headers: { 'x-organization-id': '11111111-1111-4111-8111-111111111111' },
    } as Request);
    expect(id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('ensureActiveMembership is a no-op when already active', async () => {
    const findOne = vi.fn(async () => membership({}));
    const save = vi.fn();
    const service = serviceFor({
      findOne,
      save,
      count: async () => 1,
    } as never);
    await service.ensureActiveMembership('doctor-1', 'org-a');
    expect(save).not.toHaveBeenCalled();
  });

  it('patient ownership remains separate from membership (documentation assertion)', () => {
    // Membership grants org workspace access only. patients.doctor_id is the ownership key.
    const m = membership({ doctorId: 'doctor-1', organizationId: 'org-a' });
    expect(m.organizationId).not.toBe('patient-access-grant');
    expect((m as { patientIds?: string[] }).patientIds).toBeUndefined();
  });

  it('accepting an expired invitation persists expired status then rejects', async () => {
    const { GoneException } = await import('@nestjs/common');
    const invitation = {
      id: 'inv-1',
      doctorId: 'doctor-1',
      organizationId: 'org-a',
      status: 'pending' as const,
      expiresAt: new Date(Date.now() - 60_000),
      resolvedAt: null as Date | null,
      tokenHash: 'abc',
      organization: { id: 'org-a', name: 'Org A' } as Organization,
      doctor: { userId: 'doctor-1', user: { name: 'Doc' } as User } as DoctorProfile,
    };
    const saved: Array<{ status: string; resolvedAt: Date | null }> = [];
    const inviteRepo = {
      findOne: async () => invitation,
      save: async (row: typeof invitation) => {
        saved.push({ status: row.status, resolvedAt: row.resolvedAt });
        return row;
      },
    };
    const service = new MembershipsService(
      {} as Repository<DoctorOrganizationMembership>,
      inviteRepo as unknown as Repository<DoctorOrganizationInvitation>,
      {} as Repository<DoctorProfile>,
      {} as Repository<Organization>,
      {} as Repository<User>,
      {} as Repository<import('../entities/patient-profile.entity').PatientProfile>,
      {
        transaction: async (fn: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>) =>
          fn({
            getRepository: (entity) => {
              if (entity === DoctorOrganizationInvitation) return inviteRepo;
              return {
                findOne: async () => null,
                count: async () => 0,
                save: async () => null,
              };
            },
          }),
      } as unknown as DataSource,
      { send: async () => false } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
    );

    const actor = {
      id: 'doctor-1',
      role: 'doctor',
      email: 'd@example.com',
      name: 'Doc',
      organizationId: 'org-a',
    } as User;
    await expect(service.acceptInvitationByToken(actor, 'raw-token')).rejects.toBeInstanceOf(
      GoneException,
    );
    expect(saved.some((s) => s.status === 'expired' && s.resolvedAt != null)).toBe(true);
  });

  it('rejects acceptance from a different doctor account', async () => {
    const invitation = {
      id: 'inv-1',
      doctorId: 'doctor-1',
      organizationId: 'org-a',
      status: 'pending' as const,
      expiresAt: new Date(Date.now() + 60_000),
      resolvedAt: null as Date | null,
      tokenHash: 'abc',
      organization: { id: 'org-a', name: 'Org A' } as Organization,
      doctor: { userId: 'doctor-1', user: { name: 'Doc' } as User } as DoctorProfile,
    };
    const inviteRepo = {
      findOne: async () => invitation,
      save: async (row: typeof invitation) => row,
    };
    const service = new MembershipsService(
      {} as Repository<DoctorOrganizationMembership>,
      inviteRepo as unknown as Repository<DoctorOrganizationInvitation>,
      {} as Repository<DoctorProfile>,
      {} as Repository<Organization>,
      {} as Repository<User>,
      {} as Repository<import('../entities/patient-profile.entity').PatientProfile>,
      {
        transaction: async (fn: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>) =>
          fn({
            getRepository: (entity) => {
              if (entity === DoctorOrganizationInvitation) return inviteRepo;
              return {
                findOne: async () => null,
                count: async () => 0,
                save: async () => null,
                update: async () => undefined,
              };
            },
          }),
      } as unknown as DataSource,
      { send: async () => false } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
    );

    await expect(
      service.acceptInvitationByToken(
        { id: 'doctor-other', role: 'doctor' } as User,
        'raw-token',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('clears legacy users.organization_id when primary membership ends', async () => {
    const updates: Array<{ organizationId: string | null }> = [];
    const membershipRow = membership({
      isPrimary: true,
      membershipStatus: 'active',
    });
    const membershipRepo = {
      findOne: async (opts: { where?: { isPrimary?: boolean; membershipStatus?: string } }) => {
        if (opts?.where?.isPrimary === true) return null;
        return membershipRow;
      },
      save: async (row: DoctorOrganizationMembership) => row,
    };
    const userRepo = {
      update: async (_where: unknown, patch: { organizationId: string | null }) => {
        updates.push(patch);
      },
    };
    const service = new MembershipsService(
      membershipRepo as unknown as Repository<DoctorOrganizationMembership>,
      {} as Repository<DoctorOrganizationInvitation>,
      {} as Repository<DoctorProfile>,
      {} as Repository<Organization>,
      userRepo as unknown as Repository<User>,
      {} as Repository<import('../entities/patient-profile.entity').PatientProfile>,
      {
        transaction: async (fn: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>) =>
          fn({
            getRepository: (entity) => {
              if (entity === User) return userRepo;
              if (entity === DoctorOrganizationMembership) return membershipRepo;
              return membershipRepo;
            },
          }),
      } as unknown as DataSource,
      { send: async () => false } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
    );

    await service.updateMembershipStatus(admin('org-a'), 'org-a', 'doctor-1', {
      status: 'ended',
    });
    expect(updates.some((u) => u.organizationId === null)).toBe(true);
  });
});

void NotFoundException;
void BadRequestException;
