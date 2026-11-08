import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type FindOptionsSelect } from 'typeorm';
import {
  assertIanaTimeZone,
  buildDoctorPrescriptionAnalytics,
  buildPrescriptionPeriod,
  calendarDayKey,
  PERIOD_SESSION_CAP,
  projectPatientPrescriptionPeriod,
  projectPatientPrescriptionPractice,
  utcInstantMs,
  type DoctorPrescriptionAnalytics,
  type PrescriptionPeriod,
  type PrescriptionPracticeSession,
} from '@candela/shared';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { GameSession } from '../entities/game-session.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { PrescriptionRevision } from '../entities/prescription-revision.entity';
import { User } from '../entities/user.entity';
import { revisionRecord } from './revision-record';

export class PrescriptionPeriodQueryDto {
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

export type PrescriptionPeriodQuery = PrescriptionPeriodQueryDto;

/**
 * Columns read by `toPracticeSession` plus `sessionNumber`, which orders the ranged query.
 * `detail` and `detailVersion` are not part of this calculation.
 */
export const PRACTICE_SESSION_FIELDS = [
  'id',
  'sessionNumber',
  'gameId',
  'levelId',
  'recordedAt',
  'correct',
  'wrongTaps',
  'misses',
  'timeouts',
  'accuracy',
  'avgReactionSec',
  'reactionMs',
  'stimuliCount',
  'createdAt',
  'prescriptionRevisionId',
] as const satisfies readonly (keyof GameSession)[];

const PRACTICE_SESSION_SELECT = Object.fromEntries(
  PRACTICE_SESSION_FIELDS.map((field) => [field, true]),
) as FindOptionsSelect<GameSession>;

interface PeriodBounds {
  from: string;
  to: string;
  timeZone: string;
  localFrom: string;
  localTo: string;
}

/** Absent parameters keep the lifetime response. A partial set is rejected. */
export function readPrescriptionPeriodQuery(query?: PrescriptionPeriodQuery): PeriodBounds | null {
  const from = query?.from?.trim() ?? '';
  const to = query?.to?.trim() ?? '';
  const timeZone = query?.timeZone?.trim() ?? '';
  const present = [from, to, timeZone].filter((value) => value.length > 0).length;
  if (present === 0) return null;
  if (!from || !to || !timeZone) {
    throw new BadRequestException('from, to, and timeZone are required together');
  }
  try {
    assertIanaTimeZone(timeZone);
  } catch {
    throw new BadRequestException('Invalid time zone');
  }
  const start = utcInstantMs(from);
  const end = utcInstantMs(to);
  if (start == null || end == null || end <= start) {
    throw new BadRequestException('Invalid date range');
  }
  const localFrom = calendarDayKey(from, timeZone);
  const localTo = calendarDayKey(new Date(end - 1).toISOString(), timeZone);
  if (localFrom === 'unknown' || localTo === 'unknown' || localFrom > localTo) {
    throw new BadRequestException('Invalid date range');
  }
  return { from, to, timeZone, localFrom, localTo };
}

@Injectable()
export class PrescriptionAnalyticsService {
  constructor(
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
    @InjectRepository(PrescriptionRevision) private readonly revisions: Repository<PrescriptionRevision>,
    @InjectRepository(GameSession) private readonly sessions: Repository<GameSession>,
    @InjectRepository(DoctorProfile) private readonly doctors: Repository<DoctorProfile>,
  ) {}

  async forDoctor(doctorId: string, patientId: string, query?: PrescriptionPeriodQuery) {
    const patient = await this.patients.findOne({ where: { userId: patientId, doctorId } });
    if (!patient) return null;
    return this.compose(patientId, readPrescriptionPeriodQuery(query));
  }

  async forPatient(user: User, query?: PrescriptionPeriodQuery) {
    if (user.role !== 'patient') {
      throw new ForbiddenException('Only patient accounts can read prescription practice');
    }
    const patient = await this.patients.findOne({ where: { userId: user.id } });
    if (!patient) {
      throw new ForbiddenException('Only patient accounts can read prescription practice');
    }
    const periodQuery = readPrescriptionPeriodQuery(query);
    const analytics = await this.compose(user.id, periodQuery);
    const practice = projectPatientPrescriptionPractice(analytics);
    if (!analytics.period) return practice;
    return { ...practice, period: projectPatientPrescriptionPeriod(analytics.period) };
  }

  private async compose(patientId: string, periodQuery: PeriodBounds | null): Promise<DoctorPrescriptionAnalytics & { period?: PrescriptionPeriod }> {
    const [revisionRows, sessionRows, rangeRows] = await Promise.all([
      this.revisions.find({ where: { patientId }, order: { effectiveFrom: 'ASC' } }),
      this.sessions.find({
        where: { patientId },
        order: { recordedAt: 'ASC' },
        select: PRACTICE_SESSION_SELECT,
      }),
      periodQuery ? this.loadPeriodSessions(patientId, periodQuery) : Promise.resolve([]),
    ]);
    const actorIds = Array.from(
      new Set(revisionRows.map((row) => row.actorDoctorId).filter((id): id is string => Boolean(id))),
    );
    const actorNames: Record<string, string | null> = {};
    if (actorIds.length > 0) {
      const doctors = await this.doctors.find({ where: { userId: In(actorIds) }, relations: ['user'] });
      for (const actorId of actorIds) {
        const doctor = doctors.find((item) => item.userId === actorId);
        const name = doctor?.user?.name?.trim();
        actorNames[actorId] = name ? name : null;
      }
    }
    const sessions = sessionRows.map((row) => this.toPracticeSession(row));
    const revisions = revisionRows.map((row) => revisionRecord(row));
    const analytics = buildDoctorPrescriptionAnalytics({ revisions, sessions, actorNames });
    if (!periodQuery) return analytics;
    return {
      ...analytics,
      period: buildPrescriptionPeriod({
        revisions,
        sessions: rangeRows.map((row) => this.toPracticeSession(row)),
        from: periodQuery.from,
        to: periodQuery.to,
        timeZone: periodQuery.timeZone,
        localFrom: periodQuery.localFrom,
        localTo: periodQuery.localTo,
      }),
    };
  }

  /**
   * The patient/game/time index can find this patient's rows, then the time bounds are filtered.
   * One patient's range does not require a new index. The read stops at 2001 rows.
   */
  private loadPeriodSessions(patientId: string, period: PeriodBounds): Promise<GameSession[]> {
    return this.sessions
      .createQueryBuilder('s')
      .select(PRACTICE_SESSION_FIELDS.map((field) => `s.${field}`))
      .where('s.patient_id = :patientId', { patientId })
      .andWhere('s.recorded_at >= :from', { from: new Date(utcInstantMs(period.from) as number) })
      .andWhere('s.recorded_at < :to', { to: new Date(utcInstantMs(period.to) as number) })
      .orderBy('s.recorded_at', 'DESC')
      .addOrderBy('s.session_number', 'DESC')
      .take(PERIOD_SESSION_CAP + 1)
      .getMany();
  }

  private toPracticeSession(row: GameSession): PrescriptionPracticeSession {
    return {
      id: row.id,
      gameId: row.gameId,
      levelId: row.levelId,
      recordedAt: row.recordedAt.toISOString(),
      correct: row.correct,
      wrongTaps: row.wrongTaps,
      misses: row.misses,
      timeouts: row.timeouts,
      accuracy: row.accuracy,
      avgReactionSec: row.avgReactionSec,
      reactionMs: row.reactionMs || [],
      stimuliCount: row.stimuliCount,
      receivedAtMs: row.createdAt.getTime(),
      prescriptionRevisionId: row.prescriptionRevisionId ?? null,
    };
  }
}
