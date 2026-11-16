/**
 * Mocked ownership tests for Wave 0 org-scoped doctor update/delete.
 * Does not open PostgreSQL.
 */
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { assertSameOrganization } from '../common/org-scope';
import type { DoctorProfile } from '../entities/doctor-profile.entity';
import type { User } from '../entities/user.entity';
import type { UpdateDoctorDto } from './dto';

function actor(partial: Partial<User>): User {
  return {
    id: 'admin-1',
    email: 'admin@example.com',
    passwordHash: 'x',
    name: 'Admin',
    phone: null,
    googleId: null,
    role: 'admin',
    organizationId: 'org-a',
    createdAt: new Date(),
    ...partial,
  } as User;
}

function doctorUser(partial: Partial<User> = {}): User {
  return {
    id: 'doctor-1',
    email: 'doc@example.com',
    passwordHash: 'x',
    name: 'Doc',
    phone: '9999999999',
    googleId: null,
    role: 'doctor',
    organizationId: 'org-a',
    createdAt: new Date(),
    ...partial,
  } as User;
}

/**
 * Mirrors AuthService.updateDoctor / deleteDoctor org checks without Nest DI.
 * Keeps the production assertSameOrganization helper as the source of truth.
 */
async function updateDoctorScoped(
  actorUser: User,
  doctorUserId: string,
  dto: UpdateDoctorDto,
  deps: {
    findUser: (id: string) => Promise<User | null>;
    findDoctor: (id: string) => Promise<DoctorProfile | null>;
    findByEmail: (email: string) => Promise<User | null>;
    saveUser: (user: User) => Promise<User>;
  },
) {
  const user = await deps.findUser(doctorUserId);
  if (!user || user.role !== 'doctor') {
    throw new NotFoundException('Doctor not found');
  }
  assertSameOrganization(actorUser, user.organizationId, 'You cannot manage doctors outside your organisation');
  const doctorProfile = await deps.findDoctor(doctorUserId);
  if (!doctorProfile) {
    throw new NotFoundException('Doctor profile not found');
  }
  if (dto.email) {
    const email = dto.email.trim().toLowerCase();
    if (email !== user.email) {
      const existing = await deps.findByEmail(email);
      if (existing) throw new ConflictException('Email already in use');
      user.email = email;
    }
  }
  if (dto.name !== undefined) user.name = dto.name.trim();
  await deps.saveUser(user);
  return { id: user.id, email: user.email, name: user.name, referralCode: doctorProfile.referralCode };
}

async function deleteDoctorScoped(
  actorUser: User,
  doctorUserId: string,
  deps: {
    findUser: (id: string) => Promise<User | null>;
    unlinkPatients: (doctorId: string) => Promise<void>;
    deleteDoctorRow: (doctorId: string) => Promise<void>;
    deleteUser: (id: string) => Promise<void>;
  },
) {
  const user = await deps.findUser(doctorUserId);
  if (!user || user.role !== 'doctor') {
    throw new NotFoundException('Doctor not found');
  }
  assertSameOrganization(actorUser, user.organizationId, 'You cannot manage doctors outside your organisation');
  await deps.unlinkPatients(doctorUserId);
  await deps.deleteDoctorRow(doctorUserId);
  await deps.deleteUser(doctorUserId);
  return { success: true, id: doctorUserId };
}

describe('org-scoped doctor management', () => {
  it('allows hospital admin to update a doctor in the same organisation', async () => {
    const doc = doctorUser({ organizationId: 'org-a' });
    const result = await updateDoctorScoped(actor({ organizationId: 'org-a' }), doc.id, { name: 'Updated' }, {
      findUser: async () => doc,
      findDoctor: async () => ({ userId: doc.id, referralCode: 'ABC123' }) as DoctorProfile,
      findByEmail: async () => null,
      saveUser: async (u) => u,
    });
    expect(result.name).toBe('Updated');
    expect(result.referralCode).toBe('ABC123');
  });

  it('rejects hospital admin updating a doctor in another organisation', async () => {
    const doc = doctorUser({ organizationId: 'org-b' });
    await expect(
      updateDoctorScoped(actor({ organizationId: 'org-a' }), doc.id, { name: 'Nope' }, {
        findUser: async () => doc,
        findDoctor: async () => ({ userId: doc.id, referralCode: 'ABC123' }) as DoctorProfile,
        findByEmail: async () => null,
        saveUser: async (u) => u,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows super_admin to update a doctor in any organisation', async () => {
    const doc = doctorUser({ organizationId: 'org-b' });
    const result = await updateDoctorScoped(
      actor({ role: 'super_admin', organizationId: null }),
      doc.id,
      { name: 'Global' },
      {
        findUser: async () => doc,
        findDoctor: async () => ({ userId: doc.id, referralCode: 'XYZ789' }) as DoctorProfile,
        findByEmail: async () => null,
        saveUser: async (u) => u,
      },
    );
    expect(result.name).toBe('Global');
  });

  it('unlinks patients on delete but does not invent reassignment', async () => {
    const doc = doctorUser({ organizationId: 'org-a' });
    const unlinkPatients = vi.fn(async () => undefined);
    const deleteDoctorRow = vi.fn(async () => undefined);
    const deleteUser = vi.fn(async () => undefined);
    await deleteDoctorScoped(actor({ organizationId: 'org-a' }), doc.id, {
      findUser: async () => doc,
      unlinkPatients,
      deleteDoctorRow,
      deleteUser,
    });
    expect(unlinkPatients).toHaveBeenCalledWith(doc.id);
    expect(deleteDoctorRow).toHaveBeenCalledWith(doc.id);
    expect(deleteUser).toHaveBeenCalledWith(doc.id);
  });

  it('rejects cross-org delete', async () => {
    const doc = doctorUser({ organizationId: 'org-b' });
    await expect(
      deleteDoctorScoped(actor({ organizationId: 'org-a' }), doc.id, {
        findUser: async () => doc,
        unlinkPatients: async () => undefined,
        deleteDoctorRow: async () => undefined,
        deleteUser: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// Keep Repository import referenced for future full AuthService DI tests.
void (0 as unknown as Repository<User>);
