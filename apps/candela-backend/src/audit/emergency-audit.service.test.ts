import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { EmergencyAuditService } from './emergency-audit.service';
import type { EmergencyAuditLog } from '../entities/emergency-audit-log.entity';
import type { User } from '../entities/user.entity';
import type { MailService } from '../mail/mail.service';

function sa(): User {
  return {
    id: 'sa-1',
    role: 'super_admin',
    email: 'sa@example.com',
    name: 'SA',
    organizationId: null,
  } as User;
}

describe('EmergencyAuditService', () => {
  it('persists append-only audit rows with actor attribution', async () => {
    const saved: EmergencyAuditLog[] = [];
    const logs = {
      create: (row: Partial<EmergencyAuditLog>) => row,
      save: async (row: EmergencyAuditLog) => {
        const withId = { ...row, id: 'audit-1', createdAt: new Date() } as EmergencyAuditLog;
        saved.push(withId);
        return withId;
      },
    } as unknown as Repository<EmergencyAuditLog>;
    const users = {
      find: async () => [{ id: 'admin-1', email: 'a@h.com', name: 'Admin', role: 'admin' }],
    } as unknown as Repository<User>;
    const send = vi.fn(async () => true);
    const service = new EmergencyAuditService(logs, users, { send } as unknown as MailService);

    const row = await service.record({
      actor: sa(),
      organizationId: 'org-1',
      resourceType: 'patient',
      resourceId: 'p1',
      action: 'repair_patient_organization',
      reason: 'Broken ownership after migration',
      outcome: 'success',
      before: { organizationId: null },
      after: { organizationId: 'org-1' },
      notifyHospitalAdmins: true,
    });

    expect(row.id).toBe('audit-1');
    expect(saved[0].actorUserId).toBe('sa-1');
    expect(saved[0].reason).toContain('Broken ownership');
    expect(send).toHaveBeenCalledOnce();
  });

  it('does not notify on failed outcomes', async () => {
    const send = vi.fn(async () => true);
    const service = new EmergencyAuditService(
      {
        create: (row: Partial<EmergencyAuditLog>) => row,
        save: async (row: EmergencyAuditLog) =>
          ({ ...row, id: 'a2', createdAt: new Date() }) as EmergencyAuditLog,
      } as unknown as Repository<EmergencyAuditLog>,
      { find: async () => [] } as unknown as Repository<User>,
      { send } as unknown as MailService,
    );

    await service.record({
      actor: sa(),
      organizationId: 'org-1',
      resourceType: 'patient',
      action: 'repair_patient_organization',
      reason: 'attempt',
      outcome: 'failure',
      errorMessage: 'forbidden',
      notifyHospitalAdmins: true,
    });
    expect(send).not.toHaveBeenCalled();
  });
});
