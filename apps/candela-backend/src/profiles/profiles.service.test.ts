import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { DoctorProfile } from '../entities/doctor-profile.entity';
import type { Organization } from '../entities/organization.entity';
import type { PatientProfile } from '../entities/patient-profile.entity';
import type { User } from '../entities/user.entity';
import { ProfilesService } from './profiles.service';

function user(partial: Partial<User>): User {
  return {
    id: 'user-1',
    email: 'p@example.com',
    passwordHash: 'x',
    name: 'Pat',
    phone: '+919999999999',
    googleId: null,
    role: 'patient',
    organizationId: null,
    createdAt: new Date(),
    ...partial,
  } as User;
}

function patientRow(overrides: Partial<PatientProfile> & { user: User }): PatientProfile {
  return {
    userId: overrides.user.id,
    doctorId: 'doctor-1',
    organizationId: 'org-1',
    origin: 'doctor_created',
    dateOfBirth: null,
    gender: null,
    preferredLanguage: null,
    city: null,
    state: null,
    country: null,
    profilePhotoPath: null,
    guardianName: null,
    guardianPhone: null,
    guardianRelationship: null,
    identityProfileCompletedAt: null,
    accountActivatedAt: null,
    trialStartedAt: null,
    trialEndsAt: null,
    prescriptions: [],
    doctor: null,
    ...overrides,
  } as PatientProfile;
}

function doctorRow(overrides: Partial<DoctorProfile> & { user: User }): DoctorProfile {
  return {
    userId: overrides.user.id,
    referralCode: 'ABC123',
    professionalTitle: null,
    specialization: null,
    qualifications: null,
    preferredLanguage: null,
    yearsExperience: null,
    externalRegistrationId: null,
    profilePhotoPath: null,
    identityProfileCompletedAt: null,
    patients: [],
    ...overrides,
  } as DoctorProfile;
}

function orgRow(partial: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'Hospital',
    code: 'H1',
    contactEmail: 'h@example.com',
    organizationType: null,
    contactPhone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    country: null,
    website: null,
    licenseNumber: null,
    logoPath: null,
    identityProfileCompletedAt: null,
    createdAt: new Date(),
    ...partial,
  } as Organization;
}

function serviceWith(repos: {
  users?: Partial<Repository<User>>;
  patients?: Partial<Repository<PatientProfile>>;
  doctors?: Partial<Repository<DoctorProfile>>;
  orgs?: Partial<Repository<Organization>>;
  membershipsService?: {
    assertDoctorCanAccessPatient?: (doctorId: string, patientId: string) => Promise<unknown>;
    assertActiveMembership?: (doctorId: string, orgId: string) => Promise<unknown>;
  };
}) {
  const membershipsService = {
    assertDoctorCanAccessPatient: async () => ({ userId: 'patient-1' }),
    assertActiveMembership: async () => ({}),
    ...repos.membershipsService,
  };
  const media = {
    signedUrlOrNull: async () => null,
  };
  return new ProfilesService(
    repos.users as Repository<User>,
    repos.patients as Repository<PatientProfile>,
    repos.doctors as Repository<DoctorProfile>,
    repos.orgs as Repository<Organization>,
    membershipsService as never,
    media as never,
  );
}

describe('ProfilesService', () => {
  it('returns patient profile with missing fields and incomplete status', async () => {
    const u = user({ role: 'patient' });
    const service = serviceWith({
      patients: {
        findOne: async () => patientRow({ user: u }),
      },
    });
    const result = await service.getMeProfile(u);
    expect(result.role).toBe('patient');
    if (result.role === 'patient') {
      expect(result.profile.completion.profileComplete).toBe(false);
      expect(result.profile.completion.missingFields).toEqual(
        expect.arrayContaining(['dateOfBirth', 'preferredLanguage', 'city', 'state', 'country']),
      );
      expect(result.profile.doctorId).toBe('doctor-1');
    }
  });

  it('partial patch updates only supplied fields and keeps prior values', async () => {
    const u = user({ role: 'patient' });
    const row = patientRow({
      user: u,
      city: 'Hyderabad',
      preferredLanguage: 'en',
    });
    const saved: PatientProfile[] = [];
    const service = serviceWith({
      users: { save: async (x) => x as User },
      patients: {
        findOne: async () => row,
        save: async (p) => {
          saved.push(p as PatientProfile);
          return p as PatientProfile;
        },
      },
    });
    await service.patchMeProfile(u, { state: 'Telangana', country: 'IN' });
    expect(row.city).toBe('Hyderabad');
    expect(row.preferredLanguage).toBe('en');
    expect(row.state).toBe('Telangana');
    expect(row.country).toBe('IN');
    expect(saved[0].identityProfileCompletedAt).toBeNull();
  });

  it('complete requires all required fields', async () => {
    const u = user({ role: 'patient' });
    const service = serviceWith({
      patients: { findOne: async () => patientRow({ user: u }) },
    });
    await expect(service.completeMeProfile(u)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets completion timestamp when complete succeeds', async () => {
    const u = user({ role: 'patient', phone: '+911234567890' });
    const row = patientRow({
      user: u,
      dateOfBirth: '1990-01-01',
      preferredLanguage: 'en',
      city: 'Hyd',
      state: 'TS',
      country: 'IN',
    });
    const service = serviceWith({
      patients: {
        findOne: async () => row,
        save: async (p) => p as PatientProfile,
      },
    });
    const result = await service.completeMeProfile(u);
    expect(result.role).toBe('patient');
    if (result.role === 'patient') {
      expect(result.profile.completion.profileComplete).toBe(true);
      expect(result.profile.completion.completedAt).toBeTruthy();
    }
  });

  it('clears completion when a required field is removed after complete', async () => {
    const u = user({ role: 'patient', phone: '+911234567890' });
    const row = patientRow({
      user: u,
      dateOfBirth: '1990-01-01',
      preferredLanguage: 'en',
      city: 'Hyd',
      state: 'TS',
      country: 'IN',
      identityProfileCompletedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const service = serviceWith({
      users: { save: async (x) => x as User },
      patients: {
        findOne: async () => row,
        save: async (p) => p as PatientProfile,
      },
    });
    await service.patchMeProfile(u, { city: null });
    expect(row.identityProfileCompletedAt).toBeNull();
  });

  it('rejects patient profile updates that attempt to change doctorId', async () => {
    const u = user({ role: 'patient' });
    const service = serviceWith({
      patients: { findOne: async () => patientRow({ user: u }) },
      users: { save: async (x) => x as User },
    });
    await expect(
      service.patchMeProfile(u, { name: 'X', doctorId: 'other' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows assigned doctor to read patient identity and denies others', async () => {
    const patientUser = user({ id: 'patient-1', role: 'patient' });
    const row = patientRow({ user: patientUser, doctorId: 'doctor-1' });
    const service = serviceWith({
      patients: {
        findOne: async () => row,
      },
      membershipsService: {
        assertDoctorCanAccessPatient: async (doctorId) => {
          if (doctorId !== 'doctor-1') throw new NotFoundException('Patient not found');
          return row;
        },
      },
    });
    const view = await service.getPatientProfileForDoctor('doctor-1', 'patient-1');
    expect(view.userId).toBe('patient-1');
    await expect(service.getPatientProfileForDoctor('doctor-2', 'patient-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects client-supplied profile photo paths', async () => {
    const u = user({ role: 'patient', phone: '+919876543210' });
    const service = serviceWith({
      users: { save: async (x) => x as User },
      patients: {
        findOne: async () => patientRow({ user: u }),
        save: async (p) => p as PatientProfile,
      },
    });
    await expect(
      service.patchMeProfile(u, { profilePhotoPath: 'https://evil.com/a.png' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects DocID modification on doctor profile', async () => {
    const u = user({ id: 'doctor-1', role: 'doctor', phone: '+919876543210' });
    const service = serviceWith({
      users: { save: async (x) => x as User },
      doctors: {
        findOne: async () => doctorRow({ user: u }),
        save: async (d) => d as DoctorProfile,
      },
    });
    await expect(
      service.patchMeProfile(u, { referralCode: 'ZZZ999' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-HTTPS organisation websites', async () => {
    const admin = user({ role: 'admin', organizationId: 'org-1' });
    const org = orgRow({ id: 'org-1' });
    const service = serviceWith({
      orgs: {
        findOne: async () => org,
        save: async (o) => o as Organization,
      },
    });
    await expect(
      service.patchOrganizationProfile(admin, 'org-1', { website: 'http://example.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid E.164 phone numbers', async () => {
    const u = user({ role: 'patient' });
    const service = serviceWith({
      users: { save: async (x) => x as User },
      patients: {
        findOne: async () => patientRow({ user: u }),
        save: async (p) => p as PatientProfile,
      },
    });
    await expect(service.patchMeProfile(u, { phone: '9876543210' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts valid E.164 phone numbers', async () => {
    const u = user({ role: 'patient', phone: '+911111111111' });
    const row = patientRow({ user: u });
    const service = serviceWith({
      users: { save: async (x) => x as User },
      patients: {
        findOne: async () => row,
        save: async (p) => p as PatientProfile,
      },
    });
    await service.patchMeProfile(u, { phone: '+919876543210' });
    expect(u.phone).toBe('+919876543210');
  });

  it('does not change DocID when doctor professional fields are patched', async () => {
    const u = user({ id: 'doctor-1', role: 'doctor', phone: '+911' });
    const row = doctorRow({ user: u, referralCode: 'ABC123' });
    const service = serviceWith({
      users: { save: async (x) => x as User },
      doctors: {
        findOne: async () => row,
        save: async (d) => d as DoctorProfile,
      },
    });
    await service.patchMeProfile(u, { professionalTitle: 'Dr', specialization: 'Optometry' });
    expect(row.referralCode).toBe('ABC123');
  });

  it('legacy name patch delegates without touching clinical fields', async () => {
    const u = user({ role: 'patient' });
    const row = patientRow({ user: u, doctorId: 'doctor-1', city: 'Hyd' });
    const service = serviceWith({
      users: { save: async (x) => x as User },
      patients: {
        findOne: async () => row,
        save: async (p) => p as PatientProfile,
      },
    });
    await service.patchLegacyName(u, 'New Name');
    expect(u.name).toBe('New Name');
    expect(row.doctorId).toBe('doctor-1');
    expect(row.city).toBe('Hyd');
  });

  it('denies cross-org admin organisation profile writes', async () => {
    const admin = user({ role: 'admin', organizationId: 'org-a' });
    const service = serviceWith({
      orgs: { findOne: async () => orgRow({ id: 'org-b' }) },
    });
    await expect(
      service.patchOrganizationProfile(admin, 'org-b', { city: 'X' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('org profile complete validates required organisation fields', async () => {
    const admin = user({ role: 'admin', organizationId: 'org-1' });
    const org = orgRow({ id: 'org-1' });
    const service = serviceWith({
      orgs: {
        findOne: async () => org,
        save: async (o) => o as Organization,
      },
    });
    await expect(service.completeOrganizationProfile(admin, 'org-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

void vi;
