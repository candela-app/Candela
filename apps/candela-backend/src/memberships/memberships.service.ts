import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  DoctorOrganizationInvitationView,
  DoctorOrganizationMembershipView,
} from '@candela/shared';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { assertSameOrganization } from '../common/org-scope';
import { DoctorOrganizationInvitation } from '../entities/doctor-organization-invitation.entity';
import { DoctorOrganizationMembership } from '../entities/doctor-organization-membership.entity';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { Organization } from '../entities/organization.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';
import { InviteDoctorDto, UpdateMembershipStatusDto } from './memberships.dto';
import { decideDoctorPatientOrgAccess } from './patient-organization';

const DEFAULT_INVITE_TTL_HOURS = 72;

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(DoctorOrganizationMembership)
    private readonly memberships: Repository<DoctorOrganizationMembership>,
    @InjectRepository(DoctorOrganizationInvitation)
    private readonly invitations: Repository<DoctorOrganizationInvitation>,
    @InjectRepository(DoctorProfile) private readonly doctors: Repository<DoctorProfile>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /**
   * Doctor patient access (fail closed):
   * - patients.doctor_id === caller
   * - patients.organization_id is non-null (authoritative owning org)
   * - caller has active membership in patients.organization_id
   * Does not grant org-wide patient lists. Does not use doctor primary as fallback.
   */
  async assertDoctorCanAccessPatient(doctorUserId: string, patientId: string): Promise<PatientProfile> {
    const patient = await this.patients.findOne({
      where: { userId: patientId },
    });
    if (!patient || patient.doctorId !== doctorUserId) {
      throw new NotFoundException('Patient not found');
    }
    if (!patient.organizationId) {
      throw new ForbiddenException(
        'Patient has no owning organisation. Associate the patient with an organisation before clinical access.',
      );
    }
    const membership = await this.memberships.findOne({
      where: {
        doctorId: doctorUserId,
        organizationId: patient.organizationId,
        membershipStatus: 'active',
      },
    });
    const decision = decideDoctorPatientOrgAccess({
      patientDoctorId: patient.doctorId,
      patientOrganizationId: patient.organizationId,
      callerDoctorId: doctorUserId,
      callerHasActiveMembershipInPatientOrg: Boolean(membership),
    });
    if (decision.ok === false) {
      if (decision.reason === 'not_assigned') {
        throw new NotFoundException('Patient not found');
      }
      if (decision.reason === 'missing_organization') {
        throw new ForbiddenException(
          'Patient has no owning organisation. Associate the patient with an organisation before clinical access.',
        );
      }
      throw new ForbiddenException('No active membership for the patient organisation');
    }
    return patient;
  }

  /** True when doctor owns patient and retains active membership in patient.organization_id. */
  async doctorCanAccessPatient(doctorUserId: string, patientId: string): Promise<boolean> {
    try {
      await this.assertDoctorCanAccessPatient(doctorUserId, patientId);
      return true;
    } catch {
      return false;
    }
  }

  /** Active membership organisation ids for a doctor (never invents a primary). */
  async listActiveMembershipOrganizationIds(doctorUserId: string): Promise<string[]> {
    const rows = await this.memberships.find({
      where: { doctorId: doctorUserId, membershipStatus: 'active' },
    });
    return rows.map((r) => r.organizationId);
  }

  /**
   * Administrative ownership repair. Fail closed: never falls back to doctor primary.
   * - admin: may assign ownership only when patient.organization_id IS NULL, and only
   *   into the admin's organisation. Same-org is a no-op. Changing from another org
   *   is forbidden (super_admin only).
   * - super_admin: may set/change organisation; if the patient is assigned, the doctor
   *   must have an active membership in the destination organisation.
   */
  async repairPatientOrganization(
    actor: User,
    patientId: string,
    organizationId: string,
  ): Promise<PatientProfile> {
    if (actor.role !== 'admin' && actor.role !== 'super_admin') {
      throw new ForbiddenException('Administrator access required');
    }

    return this.dataSource.transaction(async (manager) => {
      const orgRepo = manager.getRepository(Organization);
      const patientRepo = manager.getRepository(PatientProfile);
      const membershipRepo = manager.getRepository(DoctorOrganizationMembership);

      const org = await orgRepo.findOne({ where: { id: organizationId } });
      if (!org) {
        throw new NotFoundException('Organisation not found');
      }

      const patient = await patientRepo.findOne({
        where: { userId: patientId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!patient) {
        throw new NotFoundException('Patient not found');
      }

      if (patient.organizationId === organizationId) {
        return patient;
      }

      if (actor.role === 'admin') {
        if (!actor.organizationId || actor.organizationId !== organizationId) {
          throw new ForbiddenException(
            'Hospital administrators may only repair ownership into their own organisation',
          );
        }
        if (patient.organizationId != null) {
          throw new ForbiddenException(
            'Patient already belongs to another organisation. Cross-organisation ownership changes require a super administrator.',
          );
        }
        if (!patient.doctorId) {
          throw new BadRequestException(
            'Unassigned patients cannot be ownership-repaired by hospital admins; complete DocID association first or use super admin',
          );
        }
        const membership = await membershipRepo.findOne({
          where: {
            doctorId: patient.doctorId,
            organizationId,
            membershipStatus: 'active',
          },
        });
        if (!membership) {
          throw new ForbiddenException(
            'Assigned doctor has no active membership in the destination organisation',
          );
        }
      } else if (patient.doctorId) {
        const membership = await membershipRepo.findOne({
          where: {
            doctorId: patient.doctorId,
            organizationId,
            membershipStatus: 'active',
          },
        });
        if (!membership) {
          throw new ForbiddenException(
            'Assigned doctor has no active membership in the requested organisation',
          );
        }
      }

      patient.organizationId = organizationId;
      return patientRepo.save(patient);
    });
  }

  /**
   * Hospital admin may manage a doctor only when that doctor has an active membership
   * in the admin's organisation. Super admin unrestricted.
   */
  async assertAdminManagesDoctor(actor: User, doctorUserId: string): Promise<void> {
    if (actor.role === 'super_admin') return;
    if (actor.role !== 'admin' || !actor.organizationId) {
      throw new ForbiddenException('Administrator access required');
    }
    const membership = await this.memberships.findOne({
      where: {
        doctorId: doctorUserId,
        organizationId: actor.organizationId,
        membershipStatus: 'active',
      },
    });
    if (!membership) {
      throw new ForbiddenException('You cannot manage doctors outside your organisation');
    }
  }

  async listMyOrganizations(doctorUserId: string): Promise<DoctorOrganizationMembershipView[]> {
    const rows = await this.memberships.find({
      where: { doctorId: doctorUserId },
      relations: ['organization'],
      order: { isPrimary: 'DESC', joinedAt: 'ASC' },
    });
    return rows.map((row) => this.toMembershipView(row));
  }

  async listActiveMembershipsForDoctor(doctorUserId: string): Promise<DoctorOrganizationMembershipView[]> {
    const rows = await this.memberships.find({
      where: { doctorId: doctorUserId, membershipStatus: 'active' },
      relations: ['organization'],
      order: { isPrimary: 'DESC', joinedAt: 'ASC' },
    });
    return rows.map((row) => this.toMembershipView(row));
  }

  /**
   * Changes which membership is primary for the doctor / legacy users.organization_id.
   * Must never modify patients.organization_id.
   */
  async setPrimary(doctorUserId: string, organizationId: string): Promise<DoctorOrganizationMembershipView[]> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DoctorOrganizationMembership);
      const target = await repo.findOne({
        where: { doctorId: doctorUserId, organizationId, membershipStatus: 'active' },
        relations: ['organization'],
      });
      if (!target) {
        throw new NotFoundException('Active membership not found for that organisation');
      }
      await repo
        .createQueryBuilder()
        .update(DoctorOrganizationMembership)
        .set({ isPrimary: false })
        .where('doctor_id = :doctorId AND membership_status = :status', {
          doctorId: doctorUserId,
          status: 'active',
        })
        .execute();
      target.isPrimary = true;
      await repo.save(target);

      await this.syncLegacyOrganizationId(manager, doctorUserId);

      const rows = await repo.find({
        where: { doctorId: doctorUserId },
        relations: ['organization'],
        order: { isPrimary: 'DESC', joinedAt: 'ASC' },
      });
      return rows.map((row) => this.toMembershipView(row));
    });
  }

  /**
   * Validates that the doctor has an active membership for the given organisation.
   * Used for every X-Organization-Id scoped operation.
   */
  async assertActiveMembership(doctorUserId: string, organizationId: string): Promise<DoctorOrganizationMembership> {
    const membership = await this.memberships.findOne({
      where: { doctorId: doctorUserId, organizationId, membershipStatus: 'active' },
      relations: ['organization'],
    });
    if (!membership) {
      throw new ForbiddenException('No active membership for the requested organisation');
    }
    return membership;
  }

  async listOrganizationMemberships(
    actor: User,
    organizationId: string,
  ): Promise<DoctorOrganizationMembershipView[]> {
    this.assertAdminCanManageOrg(actor, organizationId);
    const rows = await this.memberships.find({
      where: { organizationId },
      relations: ['organization'],
      order: { membershipStatus: 'ASC', joinedAt: 'ASC' },
    });
    return rows.map((row) => this.toMembershipView(row));
  }

  async inviteDoctor(
    actor: User,
    organizationId: string,
    dto: InviteDoctorDto,
  ): Promise<{ invitation: DoctorOrganizationInvitationView; emailSent: boolean }> {
    this.assertAdminCanManageOrg(actor, organizationId);
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organisation not found');

    const doctor = await this.doctors.findOne({
      where: { userId: dto.doctorId },
      relations: ['user'],
    });
    if (!doctor || doctor.user.role !== 'doctor') {
      throw new NotFoundException('Doctor not found');
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.inviteTtlHours() * 60 * 60 * 1000);

    let invitation: DoctorOrganizationInvitation;
    try {
      invitation = await this.dataSource.transaction(async (manager) => {
        const membershipRepo = manager.getRepository(DoctorOrganizationMembership);
        const inviteRepo = manager.getRepository(DoctorOrganizationInvitation);

        const existingActive = await membershipRepo.findOne({
          where: { doctorId: doctor.userId, organizationId, membershipStatus: 'active' },
        });
        if (existingActive) {
          throw new ConflictException('Doctor already has an active membership with this organisation');
        }

        await inviteRepo.update(
          { doctorId: doctor.userId, organizationId, status: 'pending' },
          { status: 'revoked', resolvedAt: new Date() },
        );

        return inviteRepo.save(
          inviteRepo.create({
            doctorId: doctor.userId,
            organizationId,
            invitedByUserId: actor.id,
            tokenHash: hashToken(rawToken),
            status: 'pending',
            expiresAt,
            resolvedAt: null,
          }),
        );
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('A pending invitation already exists for this doctor and organisation');
      }
      throw err;
    }

    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    // Single authenticated acceptance page — membership is never activated by opening the link.
    const inviteUrl = `${frontendUrl}/org-invitation?token=${rawToken}`;
    let emailSent = false;
    try {
      emailSent = await this.mail.send({
        to: doctor.user.email,
        subject: `Invitation to join ${org.name} on Kandela`,
        text: [
          `You have been invited to join ${org.name} on Kandela.`,
          'Sign in with the invited doctor account, then accept or decline:',
          inviteUrl,
        ].join('\n'),
        html: [
          `<p>You have been invited to join <strong>${org.name}</strong> on Kandela.</p>`,
          `<p>Sign in with the invited doctor account, then accept or decline:</p>`,
          `<p><a href="${inviteUrl}">Review invitation</a></p>`,
        ].join(''),
      });
    } catch {
      emailSent = false;
    }

    return {
      invitation: await this.toInvitationView(invitation, doctor.user.name, org.name),
      emailSent,
    };
  }

  /**
   * Public preview — never activates membership. Omits token material.
   */
  async previewInvitationByToken(token: string): Promise<DoctorOrganizationInvitationView> {
    const tokenHash = hashToken(token.trim());
    const invitation = await this.invitations.findOne({
      where: { tokenHash },
      relations: ['organization', 'doctor', 'doctor.user'],
    });
    if (!invitation) {
      throw new NotFoundException('Invitation link is invalid');
    }
    await this.persistExpiredIfNeeded(this.invitations, invitation);
    if (invitation.status === 'expired' || invitation.expiresAt.getTime() < Date.now()) {
      throw new GoneException('This invitation has expired');
    }
    if (invitation.status === 'revoked') {
      throw new GoneException('This invitation has been revoked');
    }
    return this.toInvitationView(
      invitation,
      invitation.doctor?.user?.name ?? '',
      invitation.organization?.name ?? '',
    );
  }

  /**
   * Accept only when the authenticated doctor is the intended invitee.
   * Opening the link alone never activates membership.
   */
  async acceptInvitationByToken(
    actor: User,
    token: string,
  ): Promise<DoctorOrganizationMembershipView> {
    this.assertAuthenticatedInvitee(actor);
    const tokenHash = hashToken(token.trim());
    return this.dataSource.transaction(async (manager) => {
      const inviteRepo = manager.getRepository(DoctorOrganizationInvitation);
      const membershipRepo = manager.getRepository(DoctorOrganizationMembership);
      const invitation = await this.lockInvitation(inviteRepo, tokenHash);
      this.assertInviteeMatches(actor, invitation);

      if (invitation.status === 'accepted') {
        const existing = await membershipRepo.findOne({
          where: {
            doctorId: invitation.doctorId,
            organizationId: invitation.organizationId,
            membershipStatus: 'active',
          },
          relations: ['organization'],
        });
        if (existing) return this.toMembershipView(existing);
      }
      await this.assertInvitationPending(inviteRepo, invitation);

      if (!invitation.organization) {
        throw new NotFoundException('Organisation not found');
      }

      const activeCount = await membershipRepo.count({
        where: { doctorId: invitation.doctorId, membershipStatus: 'active' },
      });

      let membership = await membershipRepo.findOne({
        where: { doctorId: invitation.doctorId, organizationId: invitation.organizationId },
        order: { createdAt: 'DESC' },
      });

      if (membership?.membershipStatus === 'active') {
        invitation.status = 'accepted';
        invitation.resolvedAt = new Date();
        await inviteRepo.save(invitation);
        await this.syncLegacyOrganizationId(manager, invitation.doctorId);
        const withOrg = await membershipRepo.findOne({
          where: { id: membership.id },
          relations: ['organization'],
        });
        return this.toMembershipView(withOrg!);
      }

      if (membership) {
        membership.membershipStatus = 'active';
        membership.endedAt = null;
        membership.joinedAt = new Date();
        membership.isPrimary = activeCount === 0;
        await membershipRepo.save(membership);
      } else {
        membership = await membershipRepo.save(
          membershipRepo.create({
            doctorId: invitation.doctorId,
            organizationId: invitation.organizationId,
            membershipStatus: 'active',
            isPrimary: activeCount === 0,
            joinedAt: new Date(),
            endedAt: null,
          }),
        );
      }

      invitation.status = 'accepted';
      invitation.resolvedAt = new Date();
      await inviteRepo.save(invitation);

      await this.syncLegacyOrganizationId(manager, invitation.doctorId);

      const withOrg = await membershipRepo.findOne({
        where: { id: membership.id },
        relations: ['organization'],
      });
      return this.toMembershipView(withOrg!);
    });
  }

  async declineInvitationByToken(
    actor: User,
    token: string,
  ): Promise<DoctorOrganizationInvitationView> {
    this.assertAuthenticatedInvitee(actor);
    const tokenHash = hashToken(token.trim());
    return this.dataSource.transaction(async (manager) => {
      const inviteRepo = manager.getRepository(DoctorOrganizationInvitation);
      const invitation = await this.lockInvitation(inviteRepo, tokenHash);
      this.assertInviteeMatches(actor, invitation);
      if (invitation.status === 'declined') {
        return this.toInvitationView(
          invitation,
          invitation.doctor?.user?.name ?? '',
          invitation.organization?.name ?? '',
        );
      }
      await this.assertInvitationPending(inviteRepo, invitation);
      invitation.status = 'declined';
      invitation.resolvedAt = new Date();
      await inviteRepo.save(invitation);
      return this.toInvitationView(
        invitation,
        invitation.doctor?.user?.name ?? '',
        invitation.organization?.name ?? '',
      );
    });
  }

  private assertAuthenticatedInvitee(actor: User): void {
    if (actor.role !== 'doctor') {
      throw new ForbiddenException('Only the invited doctor can respond to this invitation');
    }
  }

  private assertInviteeMatches(actor: User, invitation: DoctorOrganizationInvitation): void {
    if (actor.id !== invitation.doctorId) {
      throw new ForbiddenException(
        'This organisation invitation was issued to a different doctor account',
      );
    }
  }

  /**
   * Keep legacy users.organization_id aligned with the active primary membership.
   * Never grants access by itself. Never mutates patients.organization_id / doctor_id.
   * Does not auto-promote another membership to primary.
   */
  private async syncLegacyOrganizationId(manager: EntityManager, doctorId: string): Promise<void> {
    const membershipRepo = manager.getRepository(DoctorOrganizationMembership);
    const userRepo = manager.getRepository(User);
    const primary = await membershipRepo.findOne({
      where: { doctorId, membershipStatus: 'active', isPrimary: true },
    });
    await userRepo.update({ id: doctorId }, { organizationId: primary?.organizationId ?? null });
  }

  private async lockInvitation(
    inviteRepo: Repository<DoctorOrganizationInvitation>,
    tokenHash: string,
  ): Promise<DoctorOrganizationInvitation> {
    const invitation = await inviteRepo.findOne({
      where: { tokenHash },
      relations: ['organization', 'doctor', 'doctor.user'],
      lock: { mode: 'pessimistic_write' },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation link is invalid');
    }
    return invitation;
  }

  private async persistExpiredIfNeeded(
    inviteRepo: Repository<DoctorOrganizationInvitation>,
    invitation: DoctorOrganizationInvitation,
  ): Promise<void> {
    if (invitation.status === 'pending' && invitation.expiresAt.getTime() < Date.now()) {
      invitation.status = 'expired';
      invitation.resolvedAt = new Date();
      await inviteRepo.save(invitation);
    }
  }

  private async assertInvitationPending(
    inviteRepo: Repository<DoctorOrganizationInvitation>,
    invitation: DoctorOrganizationInvitation,
  ): Promise<void> {
    if (invitation.status === 'revoked') {
      throw new GoneException('This invitation has been revoked');
    }
    await this.persistExpiredIfNeeded(inviteRepo, invitation);
    if (invitation.status === 'expired' || invitation.expiresAt.getTime() < Date.now()) {
      throw new GoneException('This invitation has expired');
    }
    if (invitation.status !== 'pending') {
      throw new ConflictException(`Invitation is already ${invitation.status}`);
    }
  }

  async updateMembershipStatus(
    actor: User,
    organizationId: string,
    doctorId: string,
    dto: UpdateMembershipStatusDto,
  ): Promise<DoctorOrganizationMembershipView> {
    this.assertAdminCanManageOrg(actor, organizationId);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DoctorOrganizationMembership);
      const membership = await repo.findOne({
        where: { doctorId, organizationId },
        relations: ['organization'],
        order: { createdAt: 'DESC' },
      });
      if (!membership) {
        throw new NotFoundException('Membership not found');
      }

      if (dto.status === 'ended') {
        membership.membershipStatus = 'ended';
        membership.endedAt = new Date();
        membership.isPrimary = false;
      } else if (dto.status === 'suspended') {
        membership.membershipStatus = 'suspended';
        membership.endedAt = null;
        membership.isPrimary = false;
      } else if (dto.status === 'active') {
        const conflict = await repo.findOne({
          where: { doctorId, organizationId, membershipStatus: 'active' },
        });
        if (conflict && conflict.id !== membership.id) {
          throw new ConflictException('Doctor already has an active membership with this organisation');
        }
        membership.membershipStatus = 'active';
        membership.endedAt = null;
        const activeCount = await repo.count({
          where: { doctorId, membershipStatus: 'active' },
        });
        // If this row was not active, count may include others only.
        if (activeCount === 0) {
          membership.isPrimary = true;
        }
      }

      await repo.save(membership);

      // Ending membership must not delete doctor, patients, prescriptions, or sessions.
      // Patient assignment (patients.doctor_id) / patients.organization_id intentionally untouched.
      // Sync legacy users.organization_id to active primary (or clear when none).
      await this.syncLegacyOrganizationId(manager, doctorId);

      const saved = await repo.findOne({
        where: { id: membership.id },
        relations: ['organization'],
      });
      return this.toMembershipView(saved!);
    });
  }

  /** Called when a doctor is created under an organisation — Wave 2 authoritative membership. */
  async ensureActiveMembership(
    doctorId: string,
    organizationId: string,
    opts: { primary?: boolean } = {},
  ): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(DoctorOrganizationMembership);
        const existing = await repo.findOne({
          where: { doctorId, organizationId, membershipStatus: 'active' },
          lock: { mode: 'pessimistic_write' },
        });
        if (existing) return;
        const activeCount = await repo.count({
          where: { doctorId, membershipStatus: 'active' },
        });
        await repo.save(
          repo.create({
            doctorId,
            organizationId,
            membershipStatus: 'active',
            isPrimary: opts.primary ?? activeCount === 0,
            joinedAt: new Date(),
            endedAt: null,
          }),
        );
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Concurrent create — treat as success if active row now exists.
        const existing = await this.memberships.findOne({
          where: { doctorId, organizationId, membershipStatus: 'active' },
        });
        if (existing) return;
        throw new ConflictException('Could not create organisation membership');
      }
      throw err;
    }
  }

  private assertAdminCanManageOrg(actor: User, organizationId: string): void {
    if (actor.role === 'super_admin') return;
    if (actor.role === 'admin') {
      assertSameOrganization(actor, organizationId);
      return;
    }
    throw new ForbiddenException('Only organisation administrators can manage memberships');
  }

  private inviteTtlHours(): number {
    const raw = Number(this.config.get<string>('ORG_INVITE_TTL_HOURS'));
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_INVITE_TTL_HOURS;
    return raw;
  }

  private toMembershipView(row: DoctorOrganizationMembership): DoctorOrganizationMembershipView {
    return {
      id: row.id,
      organizationId: row.organizationId,
      organizationName: row.organization?.name ?? '',
      organizationCode: row.organization?.code ?? '',
      membershipStatus: row.membershipStatus,
      isPrimary: row.isPrimary,
      joinedAt: row.joinedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    };
  }

  private async toInvitationView(
    invitation: DoctorOrganizationInvitation,
    doctorName: string,
    organizationName: string,
  ): Promise<DoctorOrganizationInvitationView> {
    return {
      id: invitation.id,
      doctorId: invitation.doctorId,
      doctorName,
      organizationId: invitation.organizationId,
      organizationName,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  if (code === '23505') return true;
  const driver = (err as { driverError?: { code?: string } }).driverError;
  return driver?.code === '23505';
}
