import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  assertIanaTimeZone,
  calendarDayKey,
  localInclusiveRangeToUtc,
  type DoctorDashboardSummary,
} from '@candela/shared';
import { Repository } from 'typeorm';
import { DocIdRequest } from '../entities/docid-request.entity';
import { DoctorOrganizationMembership } from '../entities/doctor-organization-membership.entity';
import { GameSession } from '../entities/game-session.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { PrescriptionRevision } from '../entities/prescription-revision.entity';
import { decideDoctorPatientOrgAccess } from '../memberships/patient-organization';

export function resolveDashboardTimeZone(rawTimeZone?: string): string {
  const trimmed = rawTimeZone?.trim() ?? '';
  if (!trimmed) {
    return 'UTC';
  }
  try {
    return assertIanaTimeZone(trimmed);
  } catch {
    throw new BadRequestException('Invalid time zone');
  }
}

@Injectable()
export class DoctorDashboardService {
  constructor(
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
    @InjectRepository(DoctorOrganizationMembership)
    private readonly memberships: Repository<DoctorOrganizationMembership>,
    @InjectRepository(DocIdRequest) private readonly docidRequests: Repository<DocIdRequest>,
    @InjectRepository(GameSession) private readonly sessions: Repository<GameSession>,
    @InjectRepository(PrescriptionRevision)
    private readonly revisions: Repository<PrescriptionRevision>,
  ) {}

  async getSummary(
    doctorUserId: string,
    rawTimeZone?: string,
    now: Date = new Date(),
  ): Promise<DoctorDashboardSummary> {
    const timeZone = resolveDashboardTimeZone(rawTimeZone);
    const dateKey = calendarDayKey(now.toISOString(), timeZone);
    const { start, endExclusive } = localInclusiveRangeToUtc(dateKey, dateKey, timeZone);
    const startDate = new Date(start);
    const endExclusiveDate = new Date(endExclusive);

    const [assignedPatients, activeMemberships, pendingTransferCount, transfersReviewedTodayCount] =
      await Promise.all([
        this.patients.find({
          where: { doctorId: doctorUserId },
          relations: ['prescriptions'],
        }),
        this.memberships.find({
          where: { doctorId: doctorUserId, membershipStatus: 'active' },
        }),
        this.docidRequests
          .createQueryBuilder('r')
          .where('r.recipientUserId = :doctorUserId', { doctorUserId })
          .andWhere('r.status = :status', { status: 'pending' })
          .andWhere('r.source != :internal', { internal: 'internal' })
          .andWhere('r.expiresAt > :now', { now })
          .getCount(),
        this.docidRequests
          .createQueryBuilder('r')
          .where('r.recipientUserId = :doctorUserId', { doctorUserId })
          .andWhere('r.source != :internal', { internal: 'internal' })
          .andWhere('r.status IN (:...statuses)', { statuses: ['accepted', 'rejected'] })
          .andWhere('r.resolvedAt >= :startDate', { startDate })
          .andWhere('r.resolvedAt < :endExclusiveDate', { endExclusiveDate })
          .getCount(),
      ]);

    const activeOrgIds = new Set(activeMemberships.map((membership) => membership.organizationId));
    const accessiblePatients = assignedPatients.filter(
      (patient) =>
        decideDoctorPatientOrgAccess({
          patientDoctorId: patient.doctorId,
          patientOrganizationId: patient.organizationId,
          callerDoctorId: doctorUserId,
          callerHasActiveMembershipInPatientOrg: Boolean(
            patient.organizationId && activeOrgIds.has(patient.organizationId),
          ),
        }).ok === true,
    );

    const accessiblePatientIds = accessiblePatients.map((patient) => patient.userId);
    const assignedPatientCount = accessiblePatients.length;
    const patientsWithActivePlansCount = accessiblePatients.filter(
      (patient) => (patient.prescriptions?.length ?? 0) > 0,
    ).length;

    const lastSessionAtByPatientId: Record<string, string | null> = {};
    for (const id of accessiblePatientIds) {
      lastSessionAtByPatientId[id] = null;
    }

    if (accessiblePatientIds.length === 0) {
      return {
        timeZone,
        dateKey,
        assignedPatientCount,
        patientsWithActivePlansCount,
        pendingTransferCount,
        sessionsTodayCount: 0,
        transfersReviewedTodayCount,
        prescriptionsUpdatedTodayCount: 0,
        lastSessionAtByPatientId,
      };
    }

    const [sessionsTodayCount, prescriptionsUpdatedTodayCount, lastSessionRows] = await Promise.all([
      this.sessions
        .createQueryBuilder('s')
        .where('s.patientId IN (:...ids)', { ids: accessiblePatientIds })
        .andWhere('s.recordedAt >= :startDate', { startDate })
        .andWhere('s.recordedAt < :endExclusiveDate', { endExclusiveDate })
        .getCount(),
      this.revisions
        .createQueryBuilder('rev')
        .where('rev.actorDoctorId = :doctorUserId', { doctorUserId })
        .andWhere('rev.patientId IN (:...ids)', { ids: accessiblePatientIds })
        .andWhere('rev.effectiveFrom >= :startDate', { startDate })
        .andWhere('rev.effectiveFrom < :endExclusiveDate', { endExclusiveDate })
        .getCount(),
      this.sessions
        .createQueryBuilder('s')
        .select('s.patientId', 'patientId')
        .addSelect('MAX(s.recordedAt)', 'lastRecordedAt')
        .where('s.patientId IN (:...ids)', { ids: accessiblePatientIds })
        .groupBy('s.patientId')
        .getRawMany<{ patientId: string; lastRecordedAt: Date | string | null }>(),
    ]);

    for (const row of lastSessionRows) {
      if (!row.patientId || !row.lastRecordedAt) continue;
      const parsed =
        row.lastRecordedAt instanceof Date ? row.lastRecordedAt : new Date(row.lastRecordedAt);
      if (!Number.isNaN(parsed.getTime())) {
        lastSessionAtByPatientId[row.patientId] = parsed.toISOString();
      }
    }

    return {
      timeZone,
      dateKey,
      assignedPatientCount,
      patientsWithActivePlansCount,
      pendingTransferCount,
      sessionsTodayCount,
      transfersReviewedTodayCount,
      prescriptionsUpdatedTodayCount,
      lastSessionAtByPatientId,
    };
  }
}
