import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isTherapyModuleId } from '../common/catalog';
import { GameSession } from '../entities/game-session.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { CreateGameSessionDto, GameSessionQueryDto } from './game-sessions.dto';

const ADVISORY_LOCK_NS = 8713;

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
    if (existing) {
      return this.toRecord(existing);
    }

    try {
      const saved = await this.sessions.manager.transaction(async (trx) => {
        await trx.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [ADVISORY_LOCK_NS, patientId]);
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
          accuracy: dto.accuracy,
          avgReactionSec: dto.avgReactionSec,
          medianReactionSec: dto.medianReactionSec,
          efficiencyIndex: dto.efficiencyIndex,
          reactionMs: (dto.reactionMs || []).map((ms) => Math.round(ms)),
          stimuliCount: dto.stimuliCount,
          gameName: dto.gameName,
          bgColor: dto.bgColor || null,
          stimulusColor: dto.stimulusColor || null,
          contrastPercent: dto.contrastPercent ?? null,
          metricsVersion: dto.metricsVersion ?? 1,
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
    return this.list(patientId, query);
  }

  async listForDoctor(doctorId: string, patientId: string, query: GameSessionQueryDto) {
    const patient = await this.patients.findOne({ where: { userId: patientId, doctorId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return this.list(patientId, query);
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
      qb.andWhere('s.recorded_at >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!query.to.includes('T')) {
        to.setUTCHours(23, 59, 59, 999);
      }
      qb.andWhere('s.recorded_at <= :to', { to });
    }
    const rows = await qb.take(2000).getMany();
    return rows.map((row) => this.toRecord(row));
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
    };
  }
}
