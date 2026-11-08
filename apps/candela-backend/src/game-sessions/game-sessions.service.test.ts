/**
 * Mocked repository tests. They do not open PostgreSQL, so they do not prove a query plan.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Repository } from 'typeorm';
import { GameSession } from '../entities/game-session.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { GameSessionsService } from './game-sessions.service';

interface QueryCall {
  select: string | string[] | null;
  selectAlias: string | null;
  take: number | null;
  order: string[];
  listedAll: boolean;
}

function row(partial: Partial<GameSession> = {}): GameSession {
  return {
    id: 's1',
    gameId: 'rotatory',
    gameName: 'Stored name',
    levelId: 'uppercase',
    recordedAt: new Date('2026-01-15T12:00:00.000Z'),
    sessionNumber: 2,
    ...partial,
  } as GameSession;
}

function serviceFor(input: { owned?: boolean; patient?: boolean; count?: number; latest?: GameSession | null }) {
  const calls: QueryCall[] = [];
  const patients = {
    findOne: async (options: { where: { userId?: string; doctorId?: string } }) => {
      if (input.patient === false) return null;
      if (options.where.doctorId && input.owned === false) return null;
      return { userId: 'patient-1' } as PatientProfile;
    },
  };
  const sessions = {
    find: async () => {
      throw new Error('full session list was loaded');
    },
    createQueryBuilder() {
      const call: QueryCall = { select: null, selectAlias: null, take: null, order: [], listedAll: false };
      calls.push(call);
      const qb = {
        select(selection: string | string[], alias?: string) {
          call.select = selection;
          call.selectAlias = alias ?? null;
          return qb;
        },
        where() {
          return qb;
        },
        orderBy(column: string, direction: string) {
          call.order.push(`${column} ${direction}`);
          return qb;
        },
        addOrderBy(column: string, direction: string) {
          call.order.push(`${column} ${direction}`);
          return qb;
        },
        take(count: number) {
          call.take = count;
          return qb;
        },
        getRawOne: async () => ({ count: String(input.count ?? 0) }),
        getOne: async () => input.latest ?? null,
        getMany: async () => {
          call.listedAll = true;
          throw new Error('full session list was loaded');
        },
      };
      return qb;
    },
  };
  const service = new GameSessionsService(
    sessions as unknown as Repository<GameSession>,
    patients as unknown as Repository<PatientProfile>,
  );
  return { service, calls };
}

describe('practice summary API', () => {
  it('returns an empty snapshot', async () => {
    const { service, calls } = serviceFor({ count: 0, latest: null });
    const result = await service.summaryForPatient('patient-1');
    expect(result).toEqual({ sessionCount: 0, availability: 'none_saved', last: null });
    expect(calls.some((call) => call.select === 'COUNT(*)')).toBe(true);
    expect(calls.some((call) => call.take === 1)).toBe(true);
    expect(calls.some((call) => call.listedAll)).toBe(false);
  });

  it('returns one saved session and no score fields', async () => {
    const { service } = serviceFor({ count: 1, latest: row() });
    const result = await service.summaryForPatient('patient-1');
    expect(result).toEqual({
      sessionCount: 1,
      availability: 'recorded',
      last: {
        recordedAt: '2026-01-15T12:00:00.000Z',
        gameId: 'rotatory',
        gameName: 'Rotatory Wheel',
        levelId: 'uppercase',
        levelName: 'Uppercase Rotatory',
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/accuracy|efficiency|reaction|adherence/i);
  });

  it('keeps the newest row when the count covers more than one game', async () => {
    const { service } = serviceFor({
      count: 3,
      latest: row({ gameId: 'bee_tracing', gameName: 'Bee', levelId: 'straight', recordedAt: new Date('2026-04-01T00:00:00.000Z') }),
    });
    const result = await service.summaryForPatient('patient-1');
    expect(result.sessionCount).toBe(3);
    expect(result.last).toMatchObject({ gameId: 'bee_tracing', gameName: 'Bee Path Tracing', levelName: 'Straight Line' });
  });

  it('counts with COUNT and orders the single newest row', async () => {
    const { service, calls } = serviceFor({ count: 8, latest: row() });
    await service.summaryForPatient('patient-1');
    expect(calls.find((call) => call.select === 'COUNT(*)')?.selectAlias).toBe('count');
    const newest = calls.find((call) => call.take === 1);
    expect(newest?.select).toEqual(['s.recordedAt', 's.gameId', 's.gameName', 's.levelId']);
    expect(newest?.order).toEqual(['s.recorded_at DESC', 's.session_number DESC']);
    expect(Array.isArray(newest?.select) ? newest.select.join(' ') : '').not.toMatch(/detail|detailVersion|reactionMs/);
    expect(calls.every((call) => call.listedAll === false)).toBe(true);
  });

  it('returns the summary for an owned patient', async () => {
    const { service, calls } = serviceFor({ owned: true, count: 1, latest: row() });
    await expect(service.summaryForDoctor('doctor-1', 'patient-1')).resolves.toMatchObject({
      sessionCount: 1,
      last: { gameId: 'rotatory', levelId: 'uppercase' },
    });
    expect(calls.find((call) => call.take === 1)?.select).toEqual(['s.recordedAt', 's.gameId', 's.gameName', 's.levelId']);
  });

  it('uses the same not-found result when the doctor does not own the patient', async () => {
    const { service, calls } = serviceFor({ owned: false });
    await expect(service.summaryForDoctor('other-doctor', 'patient-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(calls).toHaveLength(0);
  });

  it('rejects a summary when the account is not a patient', async () => {
    const { service } = serviceFor({ patient: false });
    await expect(service.summaryForPatient('doctor-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
