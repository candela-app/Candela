import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { DataSource, Repository } from 'typeorm';
import type { DoctorOrganizationInvitation } from '../entities/doctor-organization-invitation.entity';
import { DoctorOrganizationMembership } from '../entities/doctor-organization-membership.entity';
import type { DoctorProfile } from '../entities/doctor-profile.entity';
import { Organization } from '../entities/organization.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import type { User } from '../entities/user.entity';
import type { MailService } from '../mail/mail.service';
import { MembershipsService } from './memberships.service';

function admin(orgId: string, id = 'admin-1'): User {
  return {
    id,
    role: 'admin',
    organizationId: orgId,
    email: `${id}@example.com`,
    name: 'Admin',
    phone: null,
    passwordHash: 'x',
    googleId: null,
    createdAt: new Date(),
  } as User;
}

function superAdmin(): User {
  return {
    id: 'sa-1',
    role: 'super_admin',
    organizationId: null,
    email: 'sa@example.com',
    name: 'SA',
    phone: null,
    passwordHash: 'x',
    googleId: null,
    createdAt: new Date(),
  } as User;
}

function patientRow(partial: Partial<PatientProfile>): PatientProfile {
  return {
    userId: 'patient-1',
    doctorId: 'doctor-1',
    organizationId: null,
    origin: 'doctor_created',
    ...partial,
  } as PatientProfile;
}

type Harness = {
  service: MembershipsService;
  patient: PatientProfile;
  historyWrites: unknown[];
  memberships: Array<{ doctorId: string; organizationId: string; membershipStatus: string }>;
};

function harness(input: {
  patient: PatientProfile;
  memberships?: Array<{ doctorId: string; organizationId: string; membershipStatus: string }>;
  failSave?: boolean;
}): Harness {
  /** Durable store — only updated when save succeeds (simulates committed row). */
  const durable = { ...input.patient };
  const memberships = input.memberships ?? [
    { doctorId: 'doctor-1', organizationId: 'org-a', membershipStatus: 'active' },
    { doctorId: 'doctor-1', organizationId: 'org-b', membershipStatus: 'active' },
  ];
  const historyWrites: unknown[] = [];

  const orgs = {
    findOne: async ({ where }: { where: { id: string } }) =>
      where.id === 'org-a' || where.id === 'org-b'
        ? ({ id: where.id, name: where.id, code: where.id } as Organization)
        : null,
  };

  const patients = {
    findOne: async () => ({ ...durable }),
    save: async (row: PatientProfile) => {
      if (input.failSave) throw new Error('save_failed');
      Object.assign(durable, row);
      return durable;
    },
  };
  const patient = durable;

  const membershipRepo = {
    findOne: async ({
      where,
    }: {
      where: { doctorId: string; organizationId: string; membershipStatus: string };
    }) =>
      memberships.find(
        (m) =>
          m.doctorId === where.doctorId &&
          m.organizationId === where.organizationId &&
          m.membershipStatus === where.membershipStatus,
      ) ?? null,
  };

  const service = new MembershipsService(
    {} as Repository<DoctorOrganizationMembership>,
    {} as Repository<DoctorOrganizationInvitation>,
    {} as Repository<DoctorProfile>,
    orgs as Repository<Organization>,
    {} as Repository<User>,
    patients as unknown as Repository<PatientProfile>,
    {
      transaction: async (fn: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>) =>
        fn({
          getRepository: (entity) => {
            if (entity === Organization) return orgs;
            if (entity === PatientProfile) return patients;
            if (entity === DoctorOrganizationMembership) return membershipRepo;
            return {};
          },
        }),
    } as unknown as DataSource,
    { send: async () => false } as unknown as MailService,
    { get: () => undefined } as unknown as ConfigService,
  );

  return { service, patient, historyWrites, memberships };
}

/** Endpoint-shaped wrapper mirroring AdminController / SuperAdminController repair routes. */
async function repairViaAdminEndpoint(
  service: MembershipsService,
  actor: User,
  patientId: string,
  organizationId: string,
) {
  if (actor.role !== 'admin' && actor.role !== 'super_admin') {
    throw new ForbiddenException('Administrator access required');
  }
  return service.repairPatientOrganization(actor, patientId, organizationId);
}

describe('repairPatientOrganization', () => {
  it('admin A cannot move a patient owned by B into A', async () => {
    const { service, patient } = harness({
      patient: patientRow({ organizationId: 'org-b' }),
    });
    await expect(
      repairViaAdminEndpoint(service, admin('org-a'), 'patient-1', 'org-a'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(patient.organizationId).toBe('org-b');
  });

  it('admin B cannot move a patient owned by A into B even when doctor belongs to both', async () => {
    const { service, patient } = harness({
      patient: patientRow({ organizationId: 'org-a' }),
      memberships: [
        { doctorId: 'doctor-1', organizationId: 'org-a', membershipStatus: 'active' },
        { doctorId: 'doctor-1', organizationId: 'org-b', membershipStatus: 'active' },
      ],
    });
    await expect(
      repairViaAdminEndpoint(service, admin('org-b', 'admin-b'), 'patient-1', 'org-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(patient.organizationId).toBe('org-a');
  });

  it('admin can repair a null-owned patient into their organisation when doctor is active member', async () => {
    const { service, patient } = harness({
      patient: patientRow({ organizationId: null }),
      memberships: [{ doctorId: 'doctor-1', organizationId: 'org-a', membershipStatus: 'active' }],
    });
    const result = await repairViaAdminEndpoint(service, admin('org-a'), 'patient-1', 'org-a');
    expect(result.organizationId).toBe('org-a');
    expect(patient.organizationId).toBe('org-a');
  });

  it('admin cannot repair into another organisation', async () => {
    const { service, patient } = harness({
      patient: patientRow({ organizationId: null }),
    });
    await expect(
      repairViaAdminEndpoint(service, admin('org-a'), 'patient-1', 'org-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(patient.organizationId).toBeNull();
  });

  it('admin same-org repair is a no-op', async () => {
    const { service, patient } = harness({
      patient: patientRow({ organizationId: 'org-a' }),
    });
    const result = await repairViaAdminEndpoint(service, admin('org-a'), 'patient-1', 'org-a');
    expect(result.organizationId).toBe('org-a');
    expect(patient.organizationId).toBe('org-a');
  });

  it('admin cannot repair unassigned patient', async () => {
    const { service } = harness({
      patient: patientRow({ organizationId: null, doctorId: null }),
    });
    await expect(
      repairViaAdminEndpoint(service, admin('org-a'), 'patient-1', 'org-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('super-admin cross-organisation repair still works', async () => {
    const { service, patient } = harness({
      patient: patientRow({ organizationId: 'org-a' }),
      memberships: [
        { doctorId: 'doctor-1', organizationId: 'org-a', membershipStatus: 'active' },
        { doctorId: 'doctor-1', organizationId: 'org-b', membershipStatus: 'active' },
      ],
    });
    const result = await repairViaAdminEndpoint(service, superAdmin(), 'patient-1', 'org-b');
    expect(result.organizationId).toBe('org-b');
    expect(patient.organizationId).toBe('org-b');
  });

  it('failed save leaves patient ownership unchanged', async () => {
    const { service, patient } = harness({
      patient: patientRow({ organizationId: null }),
      memberships: [{ doctorId: 'doctor-1', organizationId: 'org-a', membershipStatus: 'active' }],
      failSave: true,
    });
    await expect(
      repairViaAdminEndpoint(service, admin('org-a'), 'patient-1', 'org-a'),
    ).rejects.toThrow('save_failed');
    expect(patient.organizationId).toBeNull();
  });
});

void vi;
