/**
 * Mocked repository tests for DoctorAnalyticsService.
 * Verifies exact doctor-patient authorization predicate, strict date/timezone validation,
 * minimized patientsToReview output, metric reconciliation, and zero-session assignments lookup.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Repository } from 'typeorm';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { GameSession } from '../entities/game-session.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { PrescriptionRevision } from '../entities/prescription-revision.entity';
import { Prescription } from '../entities/prescription.entity';
import type { MembershipsService } from '../memberships/memberships.service';
import { DoctorAnalyticsService } from './doctor-analytics.service';

interface RecordedQuery {
  wheres: string[];
  params: Record<string, unknown>;
}

function buildService(input: {
  authorizedPatients?: Array<{ patientId: string; name: string }>;
  sessionStats?: Array<{ patientId: string; periodCount: number; lastSessionAt: Date | string | null }>;
  accessAllowed?: boolean;
  prescriptions?: Prescription[];
  revisions?: PrescriptionRevision[];
  doctors?: DoctorProfile[];
}) {
  const patientQueries: RecordedQuery[] = [];
  const sessionQueries: RecordedQuery[] = [];
  let sessionFindCalled = false;

  const patients = {
    createQueryBuilder() {
      const entry: RecordedQuery = { wheres: [], params: {} };
      patientQueries.push(entry);
      const qb = {
        innerJoin() {
          return qb;
        },
        select() {
          return qb;
        },
        addSelect() {
          return qb;
        },
        where(sql: string, params?: Record<string, unknown>) {
          entry.wheres.push(sql);
          if (params) Object.assign(entry.params, params);
          return qb;
        },
        andWhere(sql: string, params?: Record<string, unknown>) {
          entry.wheres.push(sql);
          if (params) Object.assign(entry.params, params);
          return qb;
        },
        orderBy() {
          return qb;
        },
        getRawMany: async () => input.authorizedPatients ?? [],
      };
      return qb;
    },
  } as unknown as Repository<PatientProfile>;

  const sessions = {
    find: async () => {
      sessionFindCalled = true;
      return [];
    },
    createQueryBuilder() {
      const entry: RecordedQuery = { wheres: [], params: {} };
      sessionQueries.push(entry);
      const qb = {
        select() {
          return qb;
        },
        addSelect() {
          return qb;
        },
        where(sql: string, params?: Record<string, unknown>) {
          entry.wheres.push(sql);
          if (params) Object.assign(entry.params, params);
          return qb;
        },
        setParameters(params: Record<string, unknown>) {
          Object.assign(entry.params, params);
          return qb;
        },
        groupBy() {
          return qb;
        },
        getRawMany: async () => input.sessionStats ?? [],
      };
      return qb;
    },
  } as unknown as Repository<GameSession>;

  const prescriptions = {
    find: async () => input.prescriptions ?? [],
  } as unknown as Repository<Prescription>;

  const revisions = {
    find: async () => input.revisions ?? [],
  } as unknown as Repository<PrescriptionRevision>;

  const doctors = {
    find: async () => input.doctors ?? [],
  } as unknown as Repository<DoctorProfile>;

  const memberships = {
    assertDoctorCanAccessPatient: async () => {
      if (input.accessAllowed === false) {
        throw new NotFoundException('Patient not found');
      }
      return { userId: 'patient-1' };
    },
  } as unknown as MembershipsService;

  return {
    service: new DoctorAnalyticsService(
      patients,
      sessions,
      prescriptions,
      revisions,
      doctors,
      memberships,
    ),
    patientQueries,
    sessionQueries,
    wasSessionFindCalled: () => sessionFindCalled,
  };
}

describe('DoctorAnalyticsService.getCaseload', () => {
  it('applies exact doctor + non-null org + active membership predicate and minimizes patientsToReview', async () => {
    const { service, patientQueries, sessionQueries } = buildService({
      authorizedPatients: [
        { patientId: 'p1', name: 'Alice' },
        { patientId: 'p2', name: 'Bob' },
        { patientId: 'p3', name: 'Cara' },
      ],
      sessionStats: [
        { patientId: 'p1', periodCount: 4, lastSessionAt: '2026-11-20T10:00:00.000Z' },
        { patientId: 'p2', periodCount: 0, lastSessionAt: '2026-09-10T09:00:00.000Z' },
      ],
    });

    const result = await service.getCaseload('doctor-1', {
      from: '2026-10-30',
      to: '2026-11-28',
      timeZone: 'Asia/Kolkata',
    });

    const authWhere = patientQueries[0]?.wheres.join(' ') ?? '';
    expect(authWhere).toContain('p.doctor_id = :doctorUserId');
    expect(authWhere).toContain('p.organization_id IS NOT NULL');
    expect(authWhere).toContain('doctor_organization_memberships');
    expect(authWhere).toContain('membership_status = :activeStatus');
    expect(patientQueries[0]?.params.activeStatus).toBe('active');

    expect((sessionQueries[0]?.params.startInclusive as Date).toISOString()).toBe(
      '2026-10-29T18:30:00.000Z',
    );
    expect((sessionQueries[0]?.params.endExclusive as Date).toISOString()).toBe(
      '2026-11-28T18:30:00.000Z',
    );

    expect(result.authorizedPatientCount).toBe(3);
    expect(result.patientsWithCompletedSessionsCount).toBe(1);
    expect(result.patientsWithNoCompletedSessionsCount).toBe(2);
    expect(
      result.patientsWithCompletedSessionsCount + result.patientsWithNoCompletedSessionsCount,
    ).toBe(result.authorizedPatientCount);
    expect(result.totalCompletedSessionsCount).toBe(4);
    expect(result.patientsToReview).toEqual([
      { patientId: 'p2', name: 'Bob', lastSessionAt: '2026-09-10T09:00:00.000Z' },
      { patientId: 'p3', name: 'Cara', lastSessionAt: null },
    ]);
    for (const row of result.patientsToReview) {
      expect(Object.keys(row).sort()).toEqual(['lastSessionAt', 'name', 'patientId']);
    }
  });

  it('defaults omitted dates to Last 30 days in supplied timezone or UTC', async () => {
    const fixedNow = new Date('2026-11-28T12:00:00.000Z');
    const { service, sessionQueries } = buildService({ authorizedPatients: [] });

    const ist = await service.getCaseload('doctor-1', { timeZone: 'Asia/Kolkata' }, fixedNow);
    expect(ist.timeZone).toBe('Asia/Kolkata');
    expect(ist.from).toBe('2026-10-30');
    expect(ist.to).toBe('2026-11-28');
    expect(sessionQueries).toHaveLength(0);

    const utc = await service.getCaseload('doctor-1', {}, fixedNow);
    expect(utc.timeZone).toBe('UTC');
    expect(utc.from).toBe('2026-10-30');
    expect(utc.to).toBe('2026-11-28');
  });

  it('rejects fixed-offset timezones, invalid dates, and inverted ranges', async () => {
    const { service } = buildService();
    await expect(
      service.getCaseload('doctor-1', { from: '2026-10-30', to: '2026-11-28', timeZone: '+05:30' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getCaseload('doctor-1', { from: '2026-02-31', to: '2026-11-28', timeZone: 'UTC' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getCaseload('doctor-1', { from: '2026-11-28', to: '2026-10-30', timeZone: 'UTC' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DoctorAnalyticsService.getPatientAssignments', () => {
  it('enforces doctor access and returns current and historical revisions without querying GameSession', async () => {
    const { service, sessionQueries, wasSessionFindCalled } = buildService({
      accessAllowed: true,
      prescriptions: [{ moduleId: 'rotatory', levels: ['uppercase'] } as Prescription],
      revisions: [
        {
          id: 'rev-1',
          patientId: 'p1',
          actorDoctorId: 'doctor-1',
          effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-11-01T00:00:00.000Z'),
          assignments: [{ moduleId: 'sorting', levels: ['numbers'] }],
        } as PrescriptionRevision,
      ],
      doctors: [{ userId: 'doctor-1', user: { name: 'Asha' } } as unknown as DoctorProfile],
    });

    const out = await service.getPatientAssignments('doctor-1', 'p1');
    expect(out.current).toEqual([{ moduleId: 'rotatory', levels: ['uppercase'] }]);
    expect(out.revisions).toHaveLength(1);
    expect(out.revisions[0]?.actorLabel).toBe('Asha');
    expect(sessionQueries).toHaveLength(0);
    expect(wasSessionFindCalled()).toBe(false);
  });

  it('rejects unauthorized doctor access', async () => {
    const { service } = buildService({ accessAllowed: false });
    await expect(service.getPatientAssignments('other-doctor', 'p1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
