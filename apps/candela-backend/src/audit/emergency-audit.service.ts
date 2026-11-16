import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { EmergencyAuditLog } from '../entities/emergency-audit-log.entity';
import { User } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';

export type EmergencyAuditInput = {
  actor: User;
  organizationId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  action: string;
  reason: string;
  outcome: 'success' | 'failure';
  correlationId?: string | null;
  errorMessage?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** When true, email hospital admins for the organisation (mutations only). */
  notifyHospitalAdmins?: boolean;
};

@Injectable()
export class EmergencyAuditService {
  constructor(
    @InjectRepository(EmergencyAuditLog)
    private readonly logs: Repository<EmergencyAuditLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  async record(input: EmergencyAuditInput): Promise<EmergencyAuditLog> {
    const row = await this.logs.save(
      this.logs.create({
        actorUserId: input.actor.id,
        actorRole: input.actor.role,
        organizationId: input.organizationId ?? null,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        action: input.action,
        reason: input.reason,
        outcome: input.outcome,
        correlationId: input.correlationId ?? randomUUID(),
        errorMessage: input.errorMessage ? input.errorMessage.slice(0, 2000) : null,
        beforeJson: input.before ?? null,
        afterJson: input.after ?? null,
      }),
    );

    if (
      input.notifyHospitalAdmins &&
      input.outcome === 'success' &&
      input.organizationId &&
      input.actor.role === 'super_admin'
    ) {
      await this.notifyOrgAdmins(input.organizationId, input.action, row.id);
    }

    return row;
  }

  private async notifyOrgAdmins(
    organizationId: string,
    action: string,
    auditId: string,
  ): Promise<void> {
    const admins = await this.users.find({
      where: { role: 'admin', organizationId },
    });
    for (const admin of admins) {
      try {
        await this.mail.send({
          to: admin.email,
          subject: 'Candela emergency intervention notice',
          text: [
            `Hello ${admin.name},`,
            '',
            'A Candela Super Administrator performed an emergency intervention that may affect your organisation.',
            `Action category: ${action}`,
            `Reference: ${auditId}`,
            '',
            'No clinical session details are included in this notice. Contact Candela support if you need a review.',
          ].join('\n'),
          html: [
            `<p>Hello ${escapeHtml(admin.name)},</p>`,
            `<p>A Candela Super Administrator performed an emergency intervention that may affect your organisation.</p>`,
            `<p><strong>Action category:</strong> ${escapeHtml(action)}<br/>`,
            `<strong>Reference:</strong> ${escapeHtml(auditId)}</p>`,
            `<p>No clinical session details are included in this notice.</p>`,
          ].join(''),
        });
      } catch {
        // Notification failure must not roll back the audited action.
      }
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
