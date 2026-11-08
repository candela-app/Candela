import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OVERVIEW_SESSION_CAP,
  buildPracticeSnapshot,
  type SavedPracticeSummary,
  persistedDetailVersion,
  planNewSessionRevision,
  prepareGameSessionInsert,
  sanitizeSessionDetail,
  selectNewestOverview,
} from '@candela/shared';
import { isTherapyModuleId } from '../common/catalog';
import { PATIENT_ADVISORY_LOCK_NS, PATIENT_ADVISORY_LOCK_SQL } from '../common/patient-lock';
import { GameSession } from '../entities/game-session.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { PrescriptionRevision } from '../entities/prescription-revision.entity';
import { revisionRecord } from '../prescriptions/revision-record';
import { CreateGameSessionDto, GameSessionQueryDto } from './game-sessions.dto';


/** `to` is an exclusive UTC instant. Date-only strings are rejected so they are not read as UTC midnight. */
function parseRangeInstant(value: string, label: string): Date {
  if (!value.includes('T')) {
    throw new BadRequestException(`${label} must be a UTC instant`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return date;
}

@Injectable()
export class GameSessionsService {
  constructor(
    @InjectRepository(GameSession) private readonly sessions: Repository<GameSession>,
    @InjectRepository(PatientProfile) private readonly patients: Repository<PatientProfile>,
  ) {}

  async createForPatient(patientId: string, dto: CreateGameSessionDto) {
    const patient = await this.patients.findOne({ where: { userId: patientId } });
    if (!patient) {
      throw new ForbiddenException('Only patient accounts can save sessions');
    }
    if (!isTherapyModuleId(dto.gameId)) {
      throw new BadRequestException('Unknown game module');
    }
    const recordedAt = new Date(dto.recordedAt);
    if (Number.isNaN(recordedAt.getTime())) {
      throw new BadRequestException('Invalid recordedAt');
    }

    const existing = await this.sessions.findOne({
      where: { patientId, clientEventId: dto.clientEventId },
    });
    const plan = prepareGameSessionInsert(existing, {
      gameId: dto.gameId,
      correct: dto.correct,
      wrongTaps: dto.wrongTaps,
      misses: dto.misses,
      timeouts: dto.timeouts,
      accuracy: dto.accuracy,
      reactionMs: dto.reactionMs || [],
    });
    if (plan.kind === 'existing') {
      return this.toRecord(plan.record);
    }
    if (plan.kind === 'reject') {
      throw new BadRequestException(plan.reason);
    }
    const serverNowMs = Date.now();
    const detail = sanitizeSessionDetail(dto.gameId, dto.detail ?? null);
    const detailVersion = persistedDetailVersion(detail);

    try {
      const saved = await this.sessions.manager.transaction(async (trx) => {
        await trx.query(PATIENT_ADVISORY_LOCK_SQL, [PATIENT_ADVISORY_LOCK_NS, patientId]);
        const revisionRows = await trx.find(PrescriptionRevision, { where: { patientId } });
        const attribution = planNewSessionRevision({
          existing: false,
          existingRevisionId: null,
          recordedAt: dto.recordedAt,
          gameId: dto.gameId,
          levelId: dto.levelId || null,
          serverNowMs,
          revisions: revisionRows.map((row) => revisionRecord(row)),
        });
        const nextRow = await trx
          .createQueryBuilder()
          .select('COALESCE(MAX(s.session_number), 0) + 1', 'next')
          .from(GameSession, 's')
          .where('s.patient_id = :patientId', { patientId })
          .getRawOne<{ next: string }>();
        const sessionNumber = Number(nextRow?.next || 1);
        const row = trx.create(GameSession, {
          patientId,
          sessionNumber,
          clientEventId: dto.clientEventId,
          gameId: dto.gameId,
          levelId: dto.levelId || null,
          deviceTier: dto.deviceTier || null,
          recordedAt,
          durationSec: dto.durationSec,
          correct: dto.correct,
          wrongTaps: dto.wrongTaps,
          misses: dto.misses,
          timeouts: dto.timeouts,
          accuracy: plan.metrics.accuracy,
          avgReactionSec: plan.metrics.avgReactionSec,
          medianReactionSec: plan.metrics.medianReactionSec,
          efficiencyIndex: plan.metrics.efficiencyIndex,
          reactionMs: plan.metrics.reactionMs,
          stimuliCount: dto.stimuliCount,
          gameName: dto.gameName,
          bgColor: dto.bgColor || null,
          stimulusColor: dto.stimulusColor || null,
          contrastPercent: dto.contrastPercent ?? null,
          metricsVersion: dto.metricsVersion ?? 1,
          detail: (detail as unknown as Record<string, unknown> | null),
          detailVersion,
          prescriptionRevisionId: attribution.prescriptionRevisionId,
        });
        return trx.save(row);
      });
      return this.toRecord(saved);
    } catch {
      const raced = await this.sessions.findOne({
        where: { patientId, clientEventId: dto.clientEventId },
      });
      if (raced) {
        return this.toRecord(raced);
      }
      throw new BadRequestException('Could not save session');
    }
  }

  async listForPatient(patientId: string, query: GameSessionQueryDto) {
    await this.assertPatient(patientId);
    if (query.coverage === 'newest') return this.listNewest(patientId, query);
    return this.list(patientId, query);
  }

  async listForDoctor(doctorId: string, patientId: string, query: GameSessionQueryDto) {
    const patient = await this.patients.findOne({ where: { userId: patientId, doctorId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    if (query.coverage === 'newest') return this.listNewest(patientId, query);
    return this.list(patientId, query);
  }

  async summaryForPatient(patientId: string) {
    await this.assertPatient(patientId);
    return this.summary(patientId);
  }

  async summaryForDoctor(doctorId: string, patientId: string) {
    const patient = await this.patients.findOne({ where: { userId: patientId, doctorId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return this.summary(patientId);
  }

  /**
   * Count plus the single newest row. The row read is limited to the snapshot fields.
   * The patient/game/time index can find this patient's rows; one row does not justify a new index.
   */
  private async summary(patientId: string): Promise<SavedPracticeSummary> {
    const countRow = await this.sessions
      .createQueryBuilder('s')
      .select('COUNT(*)', 'count')
      .where('s.patient_id = :patientId', { patientId })
      .getRawOne<{ count: string }>();
    const latest = await this.sessions
      .createQueryBuilder('s')
      .select(['s.recordedAt', 's.gameId', 's.gameName', 's.levelId'])
      .where('s.patient_id = :patientId', { patientId })
      .orderBy('s.recorded_at', 'DESC')
      .addOrderBy('s.session_number', 'DESC')
      .take(1)
      .getOne();
    const sessionCount = Number(countRow?.count ?? 0);
    const snapshot = buildPracticeSnapshot({
      sessionCount: Number.isFinite(sessionCount) ? sessionCount : 0,
      latest: latest
        ? {
            recordedAt: latest.recordedAt.toISOString(),
            gameId: latest.gameId,
            gameName: latest.gameName,
            levelId: latest.levelId,
          }
        : null,
    });
    return {
      sessionCount: snapshot.sessionCount,
      availability: snapshot.availability,
      last:
        snapshot.availability === 'recorded' && snapshot.lastRecordedAt && snapshot.lastGameId && snapshot.lastGameName
          ? {
              recordedAt: snapshot.lastRecordedAt,
              gameId: snapshot.lastGameId,
              gameName: snapshot.lastGameName,
              levelId: snapshot.lastLevelId,
              levelName: snapshot.lastLevelName ?? 'Level not recorded',
            }
          : null,
    };
  }

  private async assertPatient(patientId: string) {
    const patient = await this.patients.findOne({ where: { userId: patientId } });
    if (!patient) {
      throw new ForbiddenException('Only patient accounts can read sessions');
    }
  }

  private async list(patientId: string, query: GameSessionQueryDto) {
    const qb = this.sessions
      .createQueryBuilder('s')
      .where('s.patient_id = :patientId', { patientId })
      .orderBy('s.recorded_at', 'ASC')
      .addOrderBy('s.session_number', 'ASC');
    if (query.gameId) {
      if (!isTherapyModuleId(query.gameId)) {
        throw new BadRequestException('Unknown game module');
      }
      qb.andWhere('s.game_id = :gameId', { gameId: query.gameId });
    }
    if (query.levelId) {
      qb.andWhere('s.level_id = :levelId', { levelId: query.levelId });
    }
    if (query.deviceTier) {
      qb.andWhere('s.device_tier = :deviceTier', { deviceTier: query.deviceTier });
    }
    if (query.from) {
      qb.andWhere('s.recorded_at >= :from', { from: parseRangeInstant(query.from, 'from') });
    }
    if (query.to) {
      qb.andWhere('s.recorded_at < :to', { to: parseRangeInstant(query.to, 'to') });
    }
    const rows = await qb.take(2000).getMany();
    return rows.map((row) => this.toRecord(row));
  }

  /**
   * Newest saved sessions in the same filters as `list`.
   * A 2001st row marks the result incomplete and the older rows are the ones left out.
   */
  private async listNewest(patientId: string, query: GameSessionQueryDto) {
    const qb = this.sessions
      .createQueryBuilder('s')
      .where('s.patient_id = :patientId', { patientId })
      .orderBy('s.recorded_at', 'DESC')
      .addOrderBy('s.session_number', 'DESC');
    if (query.gameId) {
      if (!isTherapyModuleId(query.gameId)) {
        throw new BadRequestException('Unknown game module');
      }
      qb.andWhere('s.game_id = :gameId', { gameId: query.gameId });
    }
    if (query.levelId) {
      qb.andWhere('s.level_id = :levelId', { levelId: query.levelId });
    }
    if (query.deviceTier) {
      qb.andWhere('s.device_tier = :deviceTier', { deviceTier: query.deviceTier });
    }
    if (query.from) {
      qb.andWhere('s.recorded_at >= :from', { from: parseRangeInstant(query.from, 'from') });
    }
    if (query.to) {
      qb.andWhere('s.recorded_at < :to', { to: parseRangeInstant(query.to, 'to') });
    }
    const rows = await qb.take(OVERVIEW_SESSION_CAP + 1).getMany();
    const selected = selectNewestOverview(rows, OVERVIEW_SESSION_CAP);
    return {
      sessions: selected.rows.slice().reverse().map((row) => this.toRecord(row)),
      truncated: selected.truncated,
      omitted: selected.omitted,
      cap: selected.cap,
    };
  }

  toRecord(row: GameSession) {
    return {
      id: row.id,
      sessionNumber: row.sessionNumber,
      gameId: row.gameId,
      levelId: row.levelId,
      deviceTier: row.deviceTier,
      recordedAt: row.recordedAt.toISOString(),
      durationSec: row.durationSec,
      correct: row.correct,
      wrongTaps: row.wrongTaps,
      misses: row.misses,
      timeouts: row.timeouts,
      accuracy: row.accuracy,
      avgReactionSec: row.avgReactionSec,
      medianReactionSec: row.medianReactionSec,
      efficiencyIndex: row.efficiencyIndex,
      reactionMs: row.reactionMs || [],
      stimuliCount: row.stimuliCount,
      gameName: row.gameName,
      bgColor: row.bgColor,
      stimulusColor: row.stimulusColor,
      contrastPercent: row.contrastPercent,
      metricsVersion: row.metricsVersion,
      detail: row.detail,
      detailVersion: row.detailVersion,
    };
  }
}
