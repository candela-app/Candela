import { createHash } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { DataSource, Repository } from 'typeorm';
import type { DoctorProfile } from '../entities/doctor-profile.entity';
import type { Organization } from '../entities/organization.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import type { Prescription } from '../entities/prescription.entity';
import type { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { GoogleInvitationChallenge } from '../entities/google-invitation-challenge.entity';
import type { DocIdService } from '../docid/docid.service';
import type { MailService } from '../mail/mail.service';
import type { MembershipsService } from '../memberships/memberships.service';
import type { GoogleAuthService } from './google-auth.service';
import { AuthService } from './auth.service';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function doctorUser(): User {
  return {
    id: 'doctor-1',
    role: 'doctor',
    email: 'doc@example.com',
    name: 'Doc',
    phone: '+911111111111',
    passwordHash: 'x',
    organizationId: 'org-a',
    googleId: null,
    createdAt: new Date(),
  } as User;
}

function adminUser(orgId = 'org-a'): User {
  return {
    id: 'admin-1',
    role: 'admin',
    email: 'admin@example.com',
    name: 'Admin',
    phone: '+911111111112',
    passwordHash: 'x',
    organizationId: orgId,
    googleId: null,
    createdAt: new Date(),
  } as User;
}

type TokenRow = PasswordResetToken & { purpose: string };

function buildAuth(opts: {
  users?: Partial<Repository<User>>;
  patients?: Partial<Repository<PatientProfile>>;
  tokens?: Partial<Repository<PasswordResetToken>> & { rows?: TokenRow[] };
  mailSend?: () => Promise<boolean>;
  doctorCanAccess?: (doctorId: string, patientId: string) => Promise<boolean>;
  assertActiveMembership?: (doctorId: string, orgId: string) => Promise<unknown>;
  transaction?: DataSource['transaction'];
}) {
  const tokenRows: TokenRow[] = opts.tokens?.rows ?? [];
  const tokensRepo = {
    update: async (where: Record<string, unknown>, patch: Partial<TokenRow>) => {
      for (const row of tokenRows) {
        const matchPurpose = !where.purpose || row.purpose === where.purpose;
        const matchUser = !where.userId || row.userId === where.userId;
        const matchUsed = where.usedAt === undefined || row.usedAt == null;
        if (matchPurpose && matchUser && matchUsed) {
          Object.assign(row, patch);
        }
      }
    },
    save: async (row: TokenRow) => {
      tokenRows.push(row);
      return row;
    },
    create: (input: Partial<TokenRow>) => ({ ...input }) as TokenRow,
    findOne: async ({ where }: { where: { tokenHash?: string } }) =>
      tokenRows.find((r) => r.tokenHash === where.tokenHash) ?? null,
    ...opts.tokens,
  };

  const usersRepo = {
    findOne: async () => null,
    save: async (u: User) => u,
    create: (input: Partial<User>) => ({ id: 'patient-1', ...input }) as User,
    ...opts.users,
  } as unknown as Repository<User>;

  const patientsRepo = {
    save: async (p: PatientProfile) => p,
    create: (input: Partial<PatientProfile>) => ({ ...input }) as PatientProfile,
    findOne: async () => null,
    ...opts.patients,
  } as unknown as Repository<PatientProfile>;

  const doctorsRepo = {
    findOne: async () => ({ userId: 'doctor-1', referralCode: 'ABC123' }) as DoctorProfile,
  } as unknown as Repository<DoctorProfile>;

  const memberships = {
    assertActiveMembership: opts.assertActiveMembership ?? (async () => ({})),
    doctorCanAccessPatient: opts.doctorCanAccess ?? (async () => true),
  } as unknown as MembershipsService;

  const mail = {
    send: opts.mailSend ?? (async () => true),
  } as unknown as MailService;

  const challengesRepo = {
    update: async () => undefined,
    save: async (row: unknown) => row,
    create: (input: unknown) => input,
    findOne: async () => null,
  };

  const userStore: { current: User | null } = { current: null };
  const patientStore: { current: PatientProfile | null } = {
    current: {
      userId: 'patient-1',
      doctorId: 'doctor-1',
      organizationId: 'org-a',
      origin: 'doctor_created',
      accountActivatedAt: null,
    } as PatientProfile,
  };

  const tokenApi = {
    create: (input: Partial<TokenRow>) => ({ ...input }) as TokenRow,
    findOne: async ({ where }: { where: { tokenHash?: string } }) => {
      const row = tokenRows.find((r) => r.tokenHash === where.tokenHash);
      return row ? { ...row } : null;
    },
    save: async (row: TokenRow) => {
      const idx = tokenRows.findIndex((r) => r.tokenHash === row.tokenHash || r.id === row.id);
      if (idx >= 0) Object.assign(tokenRows[idx]!, row);
      else tokenRows.push(row);
      return row;
    },
    update: async (where: Record<string, unknown>, patch: Partial<TokenRow>) => {
      for (const row of tokenRows) {
        if (where.userId && row.userId !== where.userId) continue;
        if (where.purpose && row.purpose !== where.purpose) continue;
        if (where.usedAt === null || (where as { usedAt?: unknown }).usedAt == null) {
          if (row.usedAt != null) continue;
        }
        Object.assign(row, patch);
      }
    },
  };

  const userApi = {
    create: (input: Partial<User>) => ({ id: 'patient-1', ...input }) as User,
    findOne: async ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id && userStore.current?.id === where.id) return { ...userStore.current };
      if (where.email && userStore.current?.email === where.email) return { ...userStore.current };
      if (opts.users?.findOne) {
        return (opts.users.findOne as (q: unknown) => Promise<User | null>)({ where });
      }
      return null;
    },
    save: async (u: User) => {
      const saved = (opts.users?.save
        ? await (opts.users.save as (row: User) => Promise<User>)(u)
        : u) as User;
      userStore.current = saved;
      return saved;
    },
  };

  const patientApi = {
    create: (input: Partial<PatientProfile>) => ({ ...input }) as PatientProfile,
    findOne: async ({ where }: { where: { userId: string } }) => {
      if (patientStore.current?.userId === where.userId) {
        return { ...patientStore.current };
      }
      if (opts.patients?.findOne) {
        return (opts.patients.findOne as (q: unknown) => Promise<PatientProfile | null>)({ where });
      }
      return null;
    },
    save: async (p: PatientProfile) => {
      const saved = (opts.patients?.save
        ? await (opts.patients.save as (row: PatientProfile) => Promise<PatientProfile>)(p)
        : p) as PatientProfile;
      patientStore.current = saved;
      return saved;
    },
  };

  const challengeApi = {
    update: async () => undefined,
    save: async (row: unknown) => row,
    create: (input: unknown) => input,
    findOne: async () => null,
  };

  const resolveRepo = (entity: unknown) => {
    if (entity === PasswordResetToken) return tokenApi;
    if (entity === User) return userApi;
    if (entity === PatientProfile) return patientApi;
    if (entity === GoogleInvitationChallenge) return challengeApi;
    return tokenApi;
  };

  const dataSource = {
    transaction:
      opts.transaction ??
      (async (fn: (m: { getRepository: (e: unknown) => unknown }) => Promise<unknown>) =>
        fn({ getRepository: resolveRepo })),
  } as unknown as DataSource;

  const service = new AuthService(
    usersRepo,
    {} as Repository<Organization>,
    doctorsRepo,
    patientsRepo,
    {} as Repository<Prescription>,
    {} as Repository<RefreshToken>,
    tokensRepo as unknown as Repository<PasswordResetToken>,
    challengesRepo as never,
    { signAsync: async () => 'jwt' } as unknown as JwtService,
    {
      listHistoryCodesByPatientIds: async () => new Map(),
    } as unknown as DocIdService,
    {} as GoogleAuthService,
    mail,
    { get: () => undefined } as unknown as ConfigService,
    memberships,
    dataSource,
  );

  return { service, tokenRows, tokensRepo, usersRepo, patientsRepo, memberships, mail };
}

describe('Wave 3 patient invitation', () => {
  it('creates patient without password and stores invitation hash with correct purpose', async () => {
    const savedUsers: User[] = [];
    const savedPatients: PatientProfile[] = [];
    const { service, tokenRows } = buildAuth({
      users: {
        findOne: async ({ where }: { where?: { id?: string; email?: string } } = {}) => {
          if (where?.email) return null;
          if (where?.id === 'patient-1') {
            return {
              id: 'patient-1',
              email: 'p@example.com',
              name: 'Pat',
              phone: '+919999999999',
              role: 'patient',
              passwordHash: null,
              organizationId: null,
              googleId: null,
              createdAt: new Date(),
            } as User;
          }
          return null;
        },
        create: (input: Partial<User>) => ({ id: 'patient-1', ...input }) as User,
        save: async (u: User) => {
          savedUsers.push(u);
          return u;
        },
      } as never,
      patients: {
        create: (input: Partial<PatientProfile>) => input as PatientProfile,
        save: async (p: PatientProfile) => {
          savedPatients.push(p);
          return p;
        },
        findOne: async () =>
          ({
            userId: 'patient-1',
            doctorId: 'doctor-1',
            organizationId: 'org-a',
            origin: 'doctor_created',
            user: {
              id: 'patient-1',
              email: 'p@example.com',
              name: 'Pat',
              phone: '+919999999999',
              role: 'patient',
              organizationId: null,
            },
            doctor: { referralCode: 'ABC123', user: { name: 'Doc' } },
            prescriptions: [],
          }) as PatientProfile,
      } as never,
      mailSend: async () => true,
    });

    const result = await service.createDoctorPatient(
      'doctor-1',
      { name: 'Pat', phone: '+919999999999', email: 'p@example.com' },
      'org-a',
    );

    expect(savedUsers[0]?.passwordHash).toBeNull();
    expect(savedPatients[0]?.organizationId).toBe('org-a');
    expect(savedPatients[0]?.doctorId).toBe('doctor-1');
    expect(result.invitation.emailSent).toBe(true);
    expect(result.invitation.expiresAt).toBeTruthy();
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0]?.purpose).toBe('patient_invitation');
    expect(tokenRows[0]?.tokenHash).toHaveLength(64);
    expect(JSON.stringify(result)).not.toMatch(/tokenHash|rawToken/);
  });

  it('keeps patient when email delivery fails', async () => {
    const savedUsers: User[] = [];
    const { service, tokenRows } = buildAuth({
      users: {
        findOne: async ({ where }: { where?: { id?: string; email?: string } } = {}) => {
          if (where?.email) return null;
          if (where?.id === 'patient-1') {
            return {
              id: 'patient-1',
              email: 'p@example.com',
              name: 'Pat',
              phone: '+919999999999',
              role: 'patient',
              passwordHash: null,
              organizationId: null,
              googleId: null,
              createdAt: new Date(),
            } as User;
          }
          return null;
        },
        create: (input: Partial<User>) => ({ id: 'patient-1', ...input }) as User,
        save: async (u: User) => {
          savedUsers.push(u);
          return u;
        },
      } as never,
      patients: {
        create: (input: Partial<PatientProfile>) => input as PatientProfile,
        save: async (p: PatientProfile) => p,
        findOne: async () =>
          ({
            userId: 'patient-1',
            doctorId: 'doctor-1',
            organizationId: 'org-a',
            origin: 'doctor_created',
            user: { id: 'patient-1', email: 'p@example.com', name: 'Pat', phone: '+919999999999', role: 'patient' },
            doctor: { referralCode: 'ABC123', user: { name: 'Doc' } },
            prescriptions: [],
          }) as PatientProfile,
      } as never,
      mailSend: async () => false,
    });

    const result = await service.createDoctorPatient(
      'doctor-1',
      { name: 'Pat', phone: '+919999999999', email: 'p@example.com' },
      'org-a',
    );
    expect(savedUsers).toHaveLength(1);
    expect(tokenRows).toHaveLength(1);
    expect(result.invitation.emailSent).toBe(false);
  });

  it('rejects create without active membership', async () => {
    const { service } = buildAuth({
      assertActiveMembership: async () => {
        throw new ForbiddenException('No active membership');
      },
    });
    await expect(
      service.createDoctorPatient(
        'doctor-1',
        { name: 'Pat', phone: '+919999999999', email: 'p@example.com' },
        'org-x',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resend invalidates only patient_invitation tokens, not password_reset', async () => {
    const invitation: TokenRow = {
      id: 't1',
      userId: 'patient-1',
      tokenHash: 'old-invite',
      purpose: 'patient_invitation',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    } as TokenRow;
    const reset: TokenRow = {
      id: 't2',
      userId: 'patient-1',
      tokenHash: 'reset-token',
      purpose: 'password_reset',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    } as TokenRow;

    const { service, tokenRows } = buildAuth({
      tokens: { rows: [invitation, reset] },
      patients: {
        findOne: async () =>
          ({
            userId: 'patient-1',
            doctorId: 'doctor-1',
            organizationId: 'org-a',
            accountActivatedAt: null,
            user: {
              id: 'patient-1',
              role: 'patient',
              email: 'p@example.com',
              name: 'Pat',
              passwordHash: null,
            },
          }) as PatientProfile,
      } as never,
      doctorCanAccess: async () => true,
      mailSend: async () => true,
    });

    await service.resendPatientInvitation(doctorUser(), 'patient-1');
    expect(invitation.usedAt).not.toBeNull();
    expect(reset.usedAt).toBeNull();
    expect(tokenRows.some((t) => t.purpose === 'patient_invitation' && t.usedAt == null)).toBe(true);
  });

  it('admin cannot resend for another organisation patient', async () => {
    const { service } = buildAuth({
      patients: {
        findOne: async () =>
          ({
            userId: 'patient-1',
            doctorId: 'doctor-1',
            organizationId: 'org-b',
            user: { id: 'patient-1', role: 'patient', passwordHash: null, email: 'p@example.com', name: 'P' },
          }) as PatientProfile,
      } as never,
    });
    await expect(service.resendPatientInvitation(adminUser('org-a'), 'patient-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects already activated account on resend', async () => {
    const { service } = buildAuth({
      patients: {
        findOne: async () =>
          ({
            userId: 'patient-1',
            doctorId: 'doctor-1',
            organizationId: 'org-a',
            accountActivatedAt: new Date(),
            user: { id: 'patient-1', role: 'patient', passwordHash: 'hashed', email: 'p@example.com', name: 'P' },
          }) as PatientProfile,
      } as never,
      doctorCanAccess: async () => true,
    });
    await expect(service.resendPatientInvitation(doctorUser(), 'patient-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('Wave 3 invitation acceptance and purpose isolation', () => {
  it('acceptPatientInvitation activates with hashed password and consumes token', async () => {
    const raw = 'a'.repeat(32);
    const user: User = {
      id: 'patient-1',
      role: 'patient',
      email: 'p@example.com',
      name: 'Pat',
      phone: '+919999999999',
      passwordHash: null,
      googleId: null,
      organizationId: null,
      createdAt: new Date(),
    } as User;
    const token: TokenRow = {
      id: 'tok-1',
      userId: 'patient-1',
      tokenHash: hashToken(raw),
      purpose: 'patient_invitation',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    } as TokenRow;

    const tokenRows = [token];
    let savedUser: User | null = null;

    let activatedAt: Date | null = null;
    const service = new AuthService(
      {
        findOne: async () => user,
      } as unknown as Repository<User>,
      {} as Repository<Organization>,
      {} as Repository<DoctorProfile>,
      {} as Repository<PatientProfile>,
      {} as Repository<Prescription>,
      {} as Repository<RefreshToken>,
      {} as Repository<PasswordResetToken>,
      { update: async () => undefined } as never,
      {} as JwtService,
      {} as DocIdService,
      {} as GoogleAuthService,
      { send: async () => true } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
      {} as MembershipsService,
      {
        transaction: async (fn: (m: { getRepository: (e: unknown) => unknown }) => Promise<unknown>) =>
          fn({
            getRepository: (entity: { name?: string }) => {
              if (entity.name === 'PasswordResetToken') {
                return {
                  findOne: async () => ({ ...token }),
                  save: async (row: TokenRow) => {
                    Object.assign(token, row);
                    return row;
                  },
                  update: async () => undefined,
                };
              }
              if (entity.name === 'PatientProfile') {
                return {
                  findOne: async () =>
                    ({
                      userId: 'patient-1',
                      origin: 'doctor_created',
                      accountActivatedAt: activatedAt,
                    }) as PatientProfile,
                  save: async (p: PatientProfile) => {
                    activatedAt = p.accountActivatedAt;
                    return p;
                  },
                };
              }
              if (entity.name === 'GoogleInvitationChallenge') {
                return { update: async () => undefined, save: async (r: unknown) => r };
              }
              return {
                findOne: async () => ({ ...user, passwordHash: savedUser?.passwordHash ?? null }),
                save: async (u: User) => {
                  savedUser = { ...u };
                  user.passwordHash = u.passwordHash;
                  return u;
                },
              };
            },
          }),
      } as unknown as DataSource,
    );

    const result = await service.acceptPatientInvitation({ token: raw, password: 'password1' });
    expect(result).toEqual({ ok: true });
    expect(user.passwordHash).toBeTruthy();
    expect(user.passwordHash).not.toBe('password1');
    expect(token.usedAt).not.toBeNull();
    expect(activatedAt).toBeTruthy();
    void tokenRows;
  });

  it('rejects password_reset token on invitation accept', async () => {
    const raw = 'b'.repeat(32);
    const token: TokenRow = {
      id: 'tok-2',
      userId: 'patient-1',
      tokenHash: hashToken(raw),
      purpose: 'password_reset',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    } as TokenRow;

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
        transaction: async (fn: (m: { getRepository: (e: unknown) => unknown }) => Promise<unknown>) =>
          fn({
            getRepository: () => ({
              findOne: async () => ({ ...token }),
              save: async () => token,
              update: async () => undefined,
            }),
          }),
      } as unknown as DataSource,
    );

    await expect(
      service.acceptPatientInvitation({ token: raw, password: 'password1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resetPassword rejects patient_invitation tokens', async () => {
    const raw = 'c'.repeat(32);
    const service = new AuthService(
      {} as Repository<User>,
      {} as Repository<Organization>,
      {} as Repository<DoctorProfile>,
      {} as Repository<PatientProfile>,
      {} as Repository<Prescription>,
      {} as Repository<RefreshToken>,
      {
        findOne: async () =>
          ({
            tokenHash: hashToken(raw),
            purpose: 'patient_invitation',
            usedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
            userId: 'patient-1',
          }) as PasswordResetToken,
      } as unknown as Repository<PasswordResetToken>,
      {} as never,
      {} as JwtService,
      {} as DocIdService,
      {} as GoogleAuthService,
      { send: async () => true } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
      {} as MembershipsService,
      {} as DataSource,
    );

    await expect(service.resetPassword({ token: raw, password: 'password1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resetPassword rejects unactivated accounts even with password_reset purpose', async () => {
    const raw = 'd'.repeat(32);
    const service = new AuthService(
      {
        findOne: async () =>
          ({
            id: 'patient-1',
            passwordHash: null,
            role: 'patient',
          }) as User,
      } as unknown as Repository<User>,
      {} as Repository<Organization>,
      {} as Repository<DoctorProfile>,
      {} as Repository<PatientProfile>,
      {} as Repository<Prescription>,
      {} as Repository<RefreshToken>,
      {
        findOne: async () =>
          ({
            tokenHash: hashToken(raw),
            purpose: 'password_reset',
            usedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
            userId: 'patient-1',
          }) as PasswordResetToken,
      } as unknown as Repository<PasswordResetToken>,
      {} as never,
      {} as JwtService,
      {} as DocIdService,
      {} as GoogleAuthService,
      { send: async () => true } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
      {} as MembershipsService,
      {} as DataSource,
    );

    await expect(service.resetPassword({ token: raw, password: 'password1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

void vi;
