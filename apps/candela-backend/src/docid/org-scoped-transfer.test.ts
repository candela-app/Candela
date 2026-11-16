/**
 * DocID admin transfer uses active membership (via assertAdminManagesDoctor semantics).
 */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { DoctorProfile } from '../entities/doctor-profile.entity';
import type { PatientProfile } from '../entities/patient-profile.entity';
import type { User } from '../entities/user.entity';

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

function doctor(id: string): DoctorProfile {
  return {
    userId: id,
    referralCode: 'ABC123',
    user: { id, role: 'doctor', email: 'd@example.com', name: 'Doc' } as User,
  } as DoctorProfile;
}

function patient(currentDoctorId: string | null): PatientProfile {
  return {
    userId: 'patient-1',
    doctorId: currentDoctorId,
    origin: 'doctor_created',
    doctor: currentDoctorId ? doctor(currentDoctorId) : null,
    user: { id: 'patient-1', name: 'Pat', email: 'p@example.com' } as User,
  } as PatientProfile;
}

function assertAdminTransferAllowed(
  adminUser: User,
  patientRow: PatientProfile,
  target: DoctorProfile,
  doctorHasActiveMembershipInAdminOrg: (doctorId: string) => boolean,
) {
  if (adminUser.role !== 'admin' || !adminUser.organizationId) {
    throw new ForbiddenException('Only hospital administrators can transfer patients');
  }
  if (!patientRow.doctorId) {
    throw new ForbiddenException(
      'You can only transfer patients currently assigned to a doctor in your organisation',
    );
  }
  if (!doctorHasActiveMembershipInAdminOrg(patientRow.doctorId)) {
    throw new ForbiddenException('You cannot manage doctors outside your organisation');
  }
  if (!doctorHasActiveMembershipInAdminOrg(target.userId)) {
    throw new ForbiddenException('You cannot manage doctors outside your organisation');
  }
  if (patientRow.doctorId === target.userId) {
    throw new ConflictException('Patient is already linked to this doctor');
  }
}

describe('org-scoped DocID transfer (membership)', () => {
  it('allows transfer when both doctors have active membership in admin org', () => {
    const members = new Set(['doctor-from', 'doctor-to']);
    expect(() =>
      assertAdminTransferAllowed(admin('org-a'), patient('doctor-from'), doctor('doctor-to'), (id) =>
        members.has(id),
      ),
    ).not.toThrow();
  });

  it('rejects when current doctor is outside admin organisation membership', () => {
    expect(() =>
      assertAdminTransferAllowed(admin('org-a'), patient('doctor-from'), doctor('doctor-to'), (id) =>
        id === 'doctor-to',
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects transfer of an unlinked patient', () => {
    expect(() =>
      assertAdminTransferAllowed(admin('org-a'), patient(null), doctor('doctor-to'), () => true),
    ).toThrow(ForbiddenException);
  });
});
