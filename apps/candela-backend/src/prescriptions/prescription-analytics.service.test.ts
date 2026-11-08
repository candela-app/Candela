/**
 * Mocked repository tests. They do not open PostgreSQL, so they do not prove a query plan,
 * a migration, or transaction behavior.
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PERIOD_SESSION_CAP } from '@candela/shared';
import type { Repository } from 'typeorm';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { GameSession } from '../entities/game-session.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { PrescriptionRevision } from '../entities/prescription-revision.entity';
import type { User } from '../entities/user.entity';
import { PRACTICE_SESSION_FIELDS, PrescriptionAnalyticsService } from './prescription-analytics.service';

const FROM = '2026-01-01T00:00:00.000Z';
const TO = '2026-02-01T00:00:00.000Z';
const ZONE = 'UTC';

interface QueryCall {
  take: number | null;
  order: string | null;
  wheres: string[];
  select: string[] | null;
}

interface FindCall {
  select: string[] | null;
  order: Record<string, string> | null;
}

function revision(partial: Partial<PrescriptionRevision> = {}): PrescriptionRevision {
  return {
    id: 'current',
    patientId: 'patient-1',
    actorDoctorId: 'doctor-internal',
    effectiveFrom: new Date(FROM),
    effectiveTo: null,
    assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }],
    ...partial,
  } as PrescriptionRevision;
}

function session(index: number, partial: Partial<GameSession> = {}): GameSession {
  const recordedAt = new Date(Date.parse('2026-01-15T00:00:00.000Z') + index * 1000);
  return {
    id: `s-${String(index).padStart(4, '0')}`,
    gameId: 'rotatory',
    levelId: 'uppercase',
    recordedAt,
    correct: 1,
    wrongTaps: 0,
    misses: 0,
    timeouts: 0,
    accuracy: 100,
    avgReactionSec: 1,
    reactionMs: [1000],
    stimuliCount: 1,
    createdAt: recordedAt,
    prescriptionRevisionId: 'current',
    sessionNumber: index + 1,
    ...partial,
  } as GameSession;
}

function serviceFor(input: {
  owned?: boolean;
  revisions?: PrescriptionRevision[];
  all?: GameSession[];
  range?: GameSession[];
}) {
  const calls: QueryCall[] = [];
  const finds: FindCall[] = [];
  const patients = {
    findOne: async () => (input.owned === false ? null : ({ userId: 'patient-1' } as PatientProfile)),
  };
  const revisions = { find: async () => input.revisions ?? [revision()] };
  const sessions = {
    find: async (options?: { select?: Record<string, boolean>; order?: Record<string, string> }) => {
      finds.push({
        select: options?.select ? Object.keys(options.select).filter((key) => options.select?.[key]) : null,
        order: options?.order ?? null,
      });
      return input.all ?? input.range ?? [];
    },
    createQueryBuilder() {
      const call: QueryCall = { take: null, order: null, wheres: [], select: null };
      calls.push(call);
      const qb = {
        select(fields: string[]) {
          call.select = fields;
          return qb;
        },
        where(sql: string) {
          call.wheres.push(sql);
          return qb;
        },
        andWhere(sql: string) {
          call.wheres.push(sql);
          return qb;
        },
        orderBy(column: string, direction: string) {
          call.order = `${column} ${direction}`;
          return qb;
        },
        addOrderBy() {
          return qb;
        },
        take(count: number) {
          call.take = count;
          return qb;
        },
        getMany: async () => input.range ?? [],
      };
      return qb;
    },
  };
  const doctors = { find: async () => [] };
  const service = new PrescriptionAnalyticsService(
    patients as unknown as Repository<PatientProfile>,
    revisions as unknown as Repository<PrescriptionRevision>,
    sessions as unknown as Repository<GameSession>,
    doctors as unknown as Repository<DoctorProfile>,
  );
  return { service, calls, finds };
}

const periodQuery = { from: FROM, to: TO, timeZone: ZONE };

describe('prescription period API', () => {
  it('returns analytics for an owned patient', async () => {
    const { service } = serviceFor({ range: [session(0)] });
    const result = await service.forDoctor('doctor-1', 'patient-1', periodQuery);
    expect(result?.activities[0].levelName).toBe('Uppercase Rotatory');
    expect(result?.period?.activities[0].sessionCount).toBe(1);
  });

  it('returns null when the doctor does not own the patient', async () => {
    const { service, calls } = serviceFor({ owned: false });
    expect(await service.forDoctor('doctor-1', 'patient-1', periodQuery)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('rejects a non-patient reading practice', async () => {
    const { service } = serviceFor({});
    await expect(service.forPatient({ id: 'doctor-1', role: 'doctor' } as User)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps the lifetime response when no range is sent', async () => {
    const { service, calls } = serviceFor({ all: [session(0)] });
    const result = await service.forDoctor('doctor-1', 'patient-1');
    expect(result).not.toHaveProperty('period');
    expect(calls).toHaveLength(0);
    expect(result?.activities[0].sessionCount).toBe(1);
  });

  it('returns a period for a valid range', async () => {
    const { service } = serviceFor({ range: [session(0)] });
    const result = await service.forPatient({ id: 'patient-1', role: 'patient' } as User, periodQuery);
    expect(result).toMatchObject({
      period: { from: '2026-01-01', to: '2026-01-31', truncated: false, incomplete: false, cap: 2000 },
    });
  });

  it('rejects an incomplete range', async () => {
    const { service } = serviceFor({});
    await expect(service.forDoctor('doctor-1', 'patient-1', { from: FROM })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown timezone', async () => {
    const { service } = serviceFor({});
    await expect(
      service.forDoctor('doctor-1', 'patient-1', { from: FROM, to: TO, timeZone: 'Not/AZone' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a reversed range', async () => {
    const { service } = serviceFor({});
    await expect(
      service.forDoctor('doctor-1', 'patient-1', { from: TO, to: FROM, timeZone: ZONE }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reads at most 2001 rows, newest first, inside the recorded-at bounds', async () => {
    const { service, calls } = serviceFor({ range: [session(0)] });
    await service.forDoctor('doctor-1', 'patient-1', periodQuery);
    expect(calls[0]).toMatchObject({ take: PERIOD_SESSION_CAP + 1, order: 's.recorded_at DESC' });
    expect(calls[0].wheres.join(' ')).toContain('s.recorded_at >= :from');
    expect(calls[0].wheres.join(' ')).toContain('s.recorded_at < :to');
  });

  it('keeps the newest 2000 rows and marks the period incomplete', async () => {
    const rows = Array.from({ length: PERIOD_SESSION_CAP + 1 }, (_, index) => session(index));
    const { service } = serviceFor({ range: rows });
    const result = await service.forDoctor('doctor-1', 'patient-1', periodQuery);
    expect(result?.period).toMatchObject({ truncated: true, omitted: 'older', incomplete: true, cap: 2000 });
    expect(result?.period?.activities[0].sessionCount).toBe(2000);
    expect(result?.period?.activities[0].firstRecordedAt).toBe(rows[1].recordedAt.toISOString());
  });

  it('keeps historical assignment detail on the doctor period only', async () => {
    const revisions = [
      revision({
        id: 'old',
        effectiveTo: new Date(TO),
        assignments: [{ moduleId: 'rotatory', levels: ['lowercase'] }],
      }),
      revision({ id: 'current', effectiveFrom: new Date(TO), assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
    ];
    const { service } = serviceFor({ revisions, range: [] });
    const doctor = await service.forDoctor('doctor-1', 'patient-1', periodQuery);
    expect(doctor?.period?.activities.some((activity) => activity.status === 'no_longer_prescribed')).toBe(true);
    const patient = await service.forPatient({ id: 'patient-1', role: 'patient' } as User, periodQuery);
    const encoded = JSON.stringify(patient);
    expect(encoded).not.toContain('no_longer_prescribed');
    expect(encoded).not.toContain('Lowercase');
    expect(encoded).not.toContain('doctor-internal');
    expect(encoded).not.toContain('actorDoctorId');
    expect(encoded).not.toContain('unattributed');
    expect(patient).not.toHaveProperty('revisions');
  });

  it('selects the same practice columns for the lifetime and ranged reads', async () => {
    const expected = [
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
    ];
    expect([...PRACTICE_SESSION_FIELDS]).toEqual(expected);
    const { service, calls, finds } = serviceFor({ all: [session(0)], range: [session(0)] });
    await service.forDoctor('doctor-1', 'patient-1', periodQuery);
    expect(finds[0]?.select).toEqual(expected);
    expect(finds[0]?.order).toEqual({ recordedAt: 'ASC' });
    expect(calls[0]?.select).toEqual(expected.map((field) => `s.${field}`));
    expect(calls[0]?.take).toBe(PERIOD_SESSION_CAP + 1);
    expect(calls[0]?.order).toBe('s.recorded_at DESC');
    const selected = `${finds[0]?.select?.join(' ')} ${calls[0]?.select?.join(' ')}`;
    expect(selected).not.toMatch(/\bdetail\b|\bdetailVersion\b|\bdeviceTier\b|\bbgColor\b/);
    expect(selected).toContain('reactionMs');
    expect(selected).toContain('createdAt');
    expect(selected).toContain('prescriptionRevisionId');
  });

  it('falls back to the stored reaction average when no samples were saved', async () => {
    const row = session(0, { reactionMs: [], avgReactionSec: 1.5 });
    const { service } = serviceFor({ all: [row], range: [row] });
    const result = await service.forDoctor('doctor-1', 'patient-1', periodQuery);
    expect(result?.activities[0].reactionMeanSec).toBe(1.5);
    expect(result?.period?.activities[0].reactionMeanSec).toBe(1.5);
  });

  it('keeps a stored revision link and an inferred link', async () => {
    const direct = session(0, { prescriptionRevisionId: 'current' });
    const inferred = session(1, { prescriptionRevisionId: null });
    const { service } = serviceFor({ all: [direct, inferred], range: [direct, inferred] });
    const result = await service.forDoctor('doctor-1', 'patient-1', periodQuery);
    expect(result?.activities[0].sessionCount).toBe(2);
    expect(result?.unattributed).toEqual([]);
    expect(result?.period?.activities[0].sessionCount).toBe(2);
    expect(result?.period?.unattributed).toEqual([]);
  });
});
