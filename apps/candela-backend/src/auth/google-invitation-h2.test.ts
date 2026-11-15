import { createHash } from 'crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { DataSource, Repository } from 'typeorm';
import type { DoctorProfile } from '../entities/doctor-profile.entity';
import type { GoogleInvitationChallenge } from '../entities/google-invitation-challenge.entity';
import type { Organization } from '../entities/organization.entity';
import type { PasswordResetToken } from '../entities/password-reset-token.entity';
import type { PatientProfile } from '../entities/patient-profile.entity';
import type { Prescription } from '../entities/prescription.entity';
import type { RefreshToken } from '../entities/refresh-token.entity';
import type { User } from '../entities/user.entity';
import type { DocIdService } from '../docid/docid.service';
import type { MailService } from '../mail/mail.service';
import type { MembershipsService } from '../memberships/memberships.service';
import type { GoogleAuthService } from './google-auth.service';
import { AuthService } from './auth.service';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function pendingUser(overrides: Partial<User> = {}): User {
  return {
    id: 'patient-1',
    role: 'patient',
    email: 'invitee@example.com',
    name: 'Invitee',
    phone: '+911234567890',
    passwordHash: null,
    googleId: null,
    organizationId: null,
    createdAt: new Date(),
    ...overrides,
  } as User;
}

function pendingPatient(overrides: Partial<PatientProfile> = {}): PatientProfile {
  return {
    userId: 'patient-1',
    doctorId: 'doctor-1',
    organizationId: 'org-a',
    origin: 'doctor_created',
    accountActivatedAt: null,
    doctor: { user: { name: 'Dr. Ada' } },
    organization: { name: 'Candela Clinic' },
    ...overrides,
  } as PatientProfile;
}

describe('H2 Google invitation Option C', () => {
  it('pending doctor-created Google login returns acceptance challenge without linking googleId', async () => {
    const user = pendingUser();
    const invitation = {
      id: 'inv-1',
      userId: 'patient-1',
      purpose: 'patient_invitation',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      tokenHash: 'x',
    } as PasswordResetToken;

    let savedUser: User | null = null;
    const challengeRows: GoogleInvitationChallenge[] = [];

    const service = new AuthService(
      {
        findOne: async ({ where }: { where: { googleId?: string; email?: string } }) => {
          if (where.googleId) return null;
          if (where.email === 'invitee@example.com') return user;
          return null;
        },
        save: async (u: User) => {
          savedUser = u;
          return u;
        },
      } as unknown as Repository<User>,
      {} as Repository<Organization>,
      {} as Repository<DoctorProfile>,
      {
        findOne: async () => pendingPatient(),
      } as unknown as Repository<PatientProfile>,
      {} as Repository<Prescription>,
      {} as Repository<RefreshToken>,
      {
        findOne: async () => invitation,
      } as unknown as Repository<PasswordResetToken>,
      {
        update: async () => undefined,
        create: (input: Partial<GoogleInvitationChallenge>) => input as GoogleInvitationChallenge,
        save: async (row: GoogleInvitationChallenge) => {
          challengeRows.push(row);
          return row;
        },
      } as unknown as Repository<GoogleInvitationChallenge>,
      { signAsync: async () => 'jwt' } as unknown as JwtService,
      { listHistoryCodesByPatientIds: async () => new Map() } as unknown as DocIdService,
      {
        verifyAccessToken: async () => ({
          googleId: 'google-sub-1',
          email: 'invitee@example.com',
          name: 'Invitee',
        }),
      } as unknown as GoogleAuthService,
      { send: async () => true } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
      {} as MembershipsService,
      {} as DataSource,
    );

    const res = { cookie: vi.fn(), clearCookie: vi.fn() } as never;
    const result = await service.loginWithGoogle({ accessToken: 'token' }, res);

    expect(result).toMatchObject({
      status: 'invitation_acceptance_required',
      message: expect.stringContaining('clinic invited'),
    });
    expect((result as { acceptanceToken: string }).acceptanceToken).toHaveLength(64);
    expect((result as { invitation: { doctorName: string } }).invitation.doctorName).toBe('Dr. Ada');
    expect(savedUser).toBeNull();
    expect(user.googleId).toBeNull();
    expect(challengeRows).toHaveLength(1);
    expect(challengeRows[0]!.googleSub).toBe('google-sub-1');
  });

  it('rejects Google login when invitation is expired', async () => {
    const user = pendingUser();
    const service = new AuthService(
      {
        findOne: async ({ where }: { where: { googleId?: string; email?: string } }) => {
          if (where.googleId) return null;
          if (where.email) return user;
          return null;
        },
      } as unknown as Repository<User>,
      {} as Repository<Organization>,
      {} as Repository<DoctorProfile>,
      {
        findOne: async () => pendingPatient(),
      } as unknown as Repository<PatientProfile>,
      {} as Repository<Prescription>,
      {} as Repository<RefreshToken>,
      {
        findOne: async () =>
          ({
            id: 'inv-1',
            userId: 'patient-1',
            purpose: 'patient_invitation',
            usedAt: null,
            expiresAt: new Date(Date.now() - 1000),
          }) as PasswordResetToken,
      } as unknown as Repository<PasswordResetToken>,
      {
        update: async () => undefined,
        create: (i: unknown) => i,
        save: async (r: unknown) => r,
      } as never,
      {} as JwtService,
      {} as DocIdService,
      {
        verifyAccessToken: async () => ({
          googleId: 'google-sub-1',
          email: 'invitee@example.com',
          name: 'Invitee',
        }),
      } as unknown as GoogleAuthService,
      { send: async () => true } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
      {} as MembershipsService,
      {} as DataSource,
    );

    await expect(service.loginWithGoogle({ accessToken: 'token' }, {} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('acceptGooglePatientInvitation links Google, activates, and issues session', async () => {
    const raw = 'e'.repeat(32);
    const user = pendingUser();
    const invitation = {
      id: 'inv-1',
      userId: 'patient-1',
      purpose: 'patient_invitation',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: 'invhash',
      createdAt: new Date(),
    } as PasswordResetToken;
    const challenge = {
      id: 'ch-1',
      tokenHash: hashToken(raw),
      userId: 'patient-1',
      invitationTokenId: 'inv-1',
      googleSub: 'google-sub-1',
      googleEmail: 'invitee@example.com',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    } as GoogleInvitationChallenge;

    let activatedAt: Date | null = null;

    const service = new AuthService(
      {
        findOne: async ({ where }: { where?: { id?: string; googleId?: string } } = {}) => {
          if (where?.googleId) return null;
          return user;
        },
        save: async (u: User) => {
          Object.assign(user, u);
          return u;
        },
      } as unknown as Repository<User>,
      {} as Repository<Organization>,
      {} as Repository<DoctorProfile>,
      {
        findOne: async () =>
          pendingPatient({
            accountActivatedAt: activatedAt ?? new Date(),
            prescriptions: [],
          }),
      } as unknown as Repository<PatientProfile>,
      {} as Repository<Prescription>,
      {
        save: async (r: unknown) => r,
        create: (i: unknown) => i,
      } as unknown as Repository<RefreshToken>,
      {} as Repository<PasswordResetToken>,
      {} as never,
      { signAsync: async () => 'access-jwt' } as unknown as JwtService,
      {
        listHistoryCodesByPatientIds: async () => new Map(),
        listHistoryCodes: async () => [],
        getPendingForPatient: async () => null,
      } as unknown as DocIdService,
      {} as GoogleAuthService,
      { send: async () => true } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
      {} as MembershipsService,
      {
        transaction: async (fn: (m: { getRepository: (e: { name?: string }) => unknown }) => Promise<unknown>) =>
          fn({
            getRepository: (entity) => {
              if (entity.name === 'GoogleInvitationChallenge') {
                return {
                  findOne: async () => ({ ...challenge }),
                  save: async (row: GoogleInvitationChallenge) => {
                    Object.assign(challenge, row);
                    return row;
                  },
                  update: async () => undefined,
                };
              }
              if (entity.name === 'PasswordResetToken') {
                return {
                  findOne: async () => ({ ...invitation }),
                  save: async (row: PasswordResetToken) => {
                    Object.assign(invitation, row);
                    return row;
                  },
                  update: async () => undefined,
                };
              }
              if (entity.name === 'PatientProfile') {
                return {
                  findOne: async () => pendingPatient({ accountActivatedAt: activatedAt }),
                  save: async (p: PatientProfile) => {
                    activatedAt = p.accountActivatedAt;
                    return p;
                  },
                };
              }
              if (entity.name === 'User') {
                return {
                  findOne: async ({ where }: { where: { id?: string; googleId?: string } }) => {
                    if (where.googleId) return null;
                    return { ...user };
                  },
                  save: async (u: User) => {
                    Object.assign(user, u);
                    return u;
                  },
                };
              }
              return {};
            },
          }),
      } as unknown as DataSource,
    );

    const res = { cookie: vi.fn(), clearCookie: vi.fn() } as never;
    const session = await service.acceptGooglePatientInvitation({ acceptanceToken: raw }, res);

    expect(user.googleId).toBe('google-sub-1');
    expect(activatedAt).toBeTruthy();
    expect(invitation.usedAt).not.toBeNull();
    expect(challenge.usedAt).not.toBeNull();
    expect(session).toMatchObject({ accessToken: 'access-jwt' });
  });

  it('rejects replay of used acceptance challenge', async () => {
    const raw = 'f'.repeat(32);
    const service = new AuthService(
      {} as Repository<User>,
      {} as Repository<Organization>,
      {} as Repository<DoctorProfile>,
      {} as Repository<PatientProfile>,
      {} as Repository<Prescription>,
      {} as Repository<RefreshToken>,
      {} as Repository<PasswordResetToken>,
      {} as never,
      {} as JwtService,
      {} as DocIdService,
      {} as GoogleAuthService,
      { send: async () => true } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
      {} as MembershipsService,
      {
        transaction: async (fn: (m: { getRepository: (e: { name?: string }) => unknown }) => Promise<unknown>) =>
          fn({
            getRepository: () => ({
              findOne: async () =>
                ({
                  tokenHash: hashToken(raw),
                  usedAt: new Date(),
                  expiresAt: new Date(Date.now() + 60_000),
                }) as GoogleInvitationChallenge,
            }),
          }),
      } as unknown as DataSource,
    );

    await expect(
      service.acceptGooglePatientInvitation({ acceptanceToken: raw }, {} as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects Google subject already linked to another user on accept', async () => {
    const raw = 'g'.repeat(32);
    const user = pendingUser();
    const service = new AuthService(
      {} as Repository<User>,
      {} as Repository<Organization>,
      {} as Repository<DoctorProfile>,
      {} as Repository<PatientProfile>,
      {} as Repository<Prescription>,
      {} as Repository<RefreshToken>,
      {} as Repository<PasswordResetToken>,
      {} as never,
      {} as JwtService,
      {} as DocIdService,
      {} as GoogleAuthService,
      { send: async () => true } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
      {} as MembershipsService,
      {
        transaction: async (fn: (m: { getRepository: (e: { name?: string }) => unknown }) => Promise<unknown>) =>
          fn({
            getRepository: (entity) => {
              if (entity.name === 'GoogleInvitationChallenge') {
                return {
                  findOne: async () =>
                    ({
                      tokenHash: hashToken(raw),
                      userId: 'patient-1',
                      invitationTokenId: 'inv-1',
                      googleSub: 'google-sub-1',
                      googleEmail: 'invitee@example.com',
                      usedAt: null,
                      expiresAt: new Date(Date.now() + 60_000),
                    }) as GoogleInvitationChallenge,
                };
              }
              if (entity.name === 'PasswordResetToken') {
                return {
                  findOne: async () =>
                    ({
                      id: 'inv-1',
                      userId: 'patient-1',
                      purpose: 'patient_invitation',
                      usedAt: null,
                      expiresAt: new Date(Date.now() + 60_000),
                    }) as PasswordResetToken,
                };
              }
              if (entity.name === 'PatientProfile') {
                return { findOne: async () => pendingPatient() };
              }
              return {
                findOne: async ({ where }: { where: { id?: string; googleId?: string } }) => {
                  if (where.googleId === 'google-sub-1') {
                    return { id: 'other-user', googleId: 'google-sub-1' } as User;
                  }
                  return user;
                },
              };
            },
          }),
      } as unknown as DataSource,
    );

    await expect(
      service.acceptGooglePatientInvitation({ acceptanceToken: raw }, {} as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('activated Google-only patient continues with normal Google login', async () => {
    const user = pendingUser({ googleId: 'google-sub-1' });
    const activatedPatient = pendingPatient({
      accountActivatedAt: new Date(),
      origin: 'doctor_created',
      prescriptions: [],
    });
    const service = new AuthService(
      {
        findOne: async ({ where }: { where: { googleId?: string; email?: string; id?: string } }) => {
          if (where.googleId === 'google-sub-1') return user;
          if (where.id === user.id) return user;
          return null;
        },
      } as unknown as Repository<User>,
      {} as Repository<Organization>,
      {} as Repository<DoctorProfile>,
      {
        findOne: async () => activatedPatient,
      } as unknown as Repository<PatientProfile>,
      {} as Repository<Prescription>,
      {
        save: async (r: unknown) => r,
        create: (i: unknown) => i,
      } as unknown as Repository<RefreshToken>,
      {} as Repository<PasswordResetToken>,
      {} as never,
      { signAsync: async () => 'jwt' } as unknown as JwtService,
      {
        listHistoryCodesByPatientIds: async () => new Map(),
        listHistoryCodes: async () => [],
        getPendingForPatient: async () => null,
      } as unknown as DocIdService,
      {
        verifyAccessToken: async () => ({
          googleId: 'google-sub-1',
          email: 'invitee@example.com',
          name: 'Invitee',
        }),
      } as unknown as GoogleAuthService,
      { send: async () => true } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
      {} as MembershipsService,
      {} as DataSource,
    );

    const session = await service.loginWithGoogle({ accessToken: 'token' }, {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as never);
    expect(session).toMatchObject({ accessToken: 'jwt' });
    expect((session as { status?: string }).status).toBeUndefined();
  });
});
