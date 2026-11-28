import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PREVIOUS_DOCTOR_LABEL,
  resolveStrictLocalPeriod,
  type CaseloadReviewPatient,
  type DoctorCaseloadAnalytics,
  type PatientAssignmentsHistory,
} from '@candela/shared';
import { IsOptional, IsString } from 'class-validator';
import { In, Repository } from 'typeorm';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { GameSession } from '../entities/game-session.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { PrescriptionRevision } from '../entities/prescription-revision.entity';
import { Prescription } from '../entities/prescription.entity';
import { MembershipsService } from '../memberships/memberships.service';
import { revisionRecord } from '../prescriptions/revision-record';

export class CaseloadAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

@Injectable()
export class DoctorAnalyticsService {
  constructor(
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
    @InjectRepository(GameSession) private readonly sessions: Repository<GameSession>,
    @InjectRepository(Prescription) private readonly prescriptions: Repository<Prescription>,
    @InjectRepository(PrescriptionRevision)
    private readonly revisions: Repository<PrescriptionRevision>,
    @InjectRepository(DoctorProfile) private readonly doctors: Repository<DoctorProfile>,
    @Inject(MembershipsService) private readonly memberships: MembershipsService,
  ) {}

  async getCaseload(
    doctorUserId: string,
    query?: CaseloadAnalyticsQueryDto,
    now: Date = new Date(),
  ): Promise<DoctorCaseloadAnalytics> {
    let period;
    try {
      period = resolveStrictLocalPeriod({
        from: query?.from,
        to: query?.to,
        timeZone: query?.timeZone,
        now,
      });
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid date range');
    }

    const startInclusive = new Date(period.startInclusive);
    const endExclusive = new Date(period.endExclusive);

    const authorizedPatients = await this.patients
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      .select('p.userId', 'patientId')
      .addSelect('u.name', 'name')
      .where('p.doctor_id = :doctorUserId', { doctorUserId })
      .andWhere('p.organization_id IS NOT NULL')
      .andWhere(
        `EXISTS (
          SELECT 1
          FROM doctor_organization_memberships m
          WHERE m.doctor_id = :doctorUserId
            AND m.organization_id = p.organization_id
            AND m.membership_status = :activeStatus
        )`,
        { doctorUserId, activeStatus: 'active' },
      )
      .orderBy('u.name', 'ASC')
      .getRawMany<{ patientId: string; name: string }>();

    if (authorizedPatients.length === 0) {
      return {
        ...period,
        authorizedPatientCount: 0,
        patientsWithCompletedSessionsCount: 0,
        patientsWithNoCompletedSessionsCount: 0,
        totalCompletedSessionsCount: 0,
        patientsToReview: [],
      };
    }

    const authorizedIds = authorizedPatients.map((row) => row.patientId);
    const statsRows = await this.sessions
      .createQueryBuilder('s')
      .select('s.patientId', 'patientId')
      .addSelect(
        'COUNT(*) FILTER (WHERE s.recorded_at >= :startInclusive AND s.recorded_at < :endExclusive)::int',
        'periodCount',
      )
      .addSelect('MAX(s.recorded_at)', 'lastSessionAt')
      .where('s.patient_id IN (:...authorizedIds)', { authorizedIds })
      .setParameters({ startInclusive, endExclusive })
      .groupBy('s.patientId')
      .getRawMany<{
        patientId: string;
        periodCount: number | string;
        lastSessionAt: Date | string | null;
      }>();

    const statsByPatientId = new Map<
      string,
      { periodCount: number; lastSessionAt: string | null }
    >();
    for (const row of statsRows) {
      if (!row.patientId) continue;
      const rawCount = Number(row.periodCount ?? 0);
      statsByPatientId.set(row.patientId, {
        periodCount: Number.isFinite(rawCount) ? Math.max(0, rawCount) : 0,
        lastSessionAt: toIsoOrNull(row.lastSessionAt),
      });
    }

    let patientsWithCompletedSessionsCount = 0;
    let patientsWithNoCompletedSessionsCount = 0;
    let totalCompletedSessionsCount = 0;
    const patientsToReview: CaseloadReviewPatient[] = [];

    for (const patient of authorizedPatients) {
      const stat = statsByPatientId.get(patient.patientId);
      const count = stat?.periodCount ?? 0;
      if (count > 0) {
        patientsWithCompletedSessionsCount += 1;
        totalCompletedSessionsCount += count;
      } else {
        patientsWithNoCompletedSessionsCount += 1;
        patientsToReview.push({
          patientId: patient.patientId,
          name: patient.name,
          lastSessionAt: stat?.lastSessionAt ?? null,
        });
      }
    }

    return {
      ...period,
      authorizedPatientCount: authorizedPatients.length,
      patientsWithCompletedSessionsCount,
      patientsWithNoCompletedSessionsCount,
      totalCompletedSessionsCount,
      patientsToReview,
    };
  }

  async getPatientAssignments(
    doctorUserId: string,
    patientId: string,
  ): Promise<PatientAssignmentsHistory> {
    await this.memberships.assertDoctorCanAccessPatient(doctorUserId, patientId);

    const [liveRows, revisionRows] = await Promise.all([
      this.prescriptions.find({ where: { patientId }, order: { moduleId: 'ASC' } }),
      this.revisions.find({ where: { patientId }, order: { effectiveFrom: 'ASC' } }),
    ]);

    const actorIds = Array.from(
      new Set(
        revisionRows
          .map((row) => row.actorDoctorId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const actorNames = new Map<string, string | null>();
    if (actorIds.length > 0) {
      const doctors = await this.doctors.find({
        where: { userId: In(actorIds) },
        relations: ['user'],
      });
      for (const doctor of doctors) {
        const name = doctor.user?.name?.trim();
        actorNames.set(doctor.userId, name || null);
      }
    }

    return {
      current: liveRows.map((row) => ({
        moduleId: row.moduleId,
        levels: row.levels ? row.levels.slice() : [],
      })),
      revisions: revisionRows.map((row) => {
        const mapped = revisionRecord(row);
        const actorName = mapped.actorDoctorId ? actorNames.get(mapped.actorDoctorId) : null;
        return {
          id: mapped.id,
          effectiveFrom: mapped.effectiveFrom,
          effectiveTo: mapped.effectiveTo,
          actorDoctorId: mapped.actorDoctorId,
          actorLabel: actorName || PREVIOUS_DOCTOR_LABEL,
          assignments: mapped.assignments.map((item) => ({
            moduleId: item.moduleId,
            levels: item.levels.slice(),
          })),
        };
      }),
    };
  }
}
